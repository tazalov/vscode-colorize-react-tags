import * as vscode from 'vscode'
import * as parser from '@babel/parser'
import traverse, { NodePath } from '@babel/traverse'
import { extractTagNameRange, getColorForLevel, getTagName } from './utils'
import { StackItem, TagRange } from './types'
import { BABEL_PLUGINS, CACHE_SIZE, DEFAULT_CONFIG, FRAGMENT } from './consts'
import {
  getDebounceDelay,
  getEnabled,
  getLightness,
  getMaxFileSize,
  getSaturation,
} from './config'

export class TagDecorator {
  // Список декораций
  private decorationTypes: Map<number, vscode.TextEditorDecorationType> =
    new Map()
  // Кеш парсера
  private parserCache: Map<string, TagRange[]> = new Map()
  // id таймаута для дебаунса обновления документа
  private idUpdateTimeout: NodeJS.Timeout | null = null
  // Конфигурация расширения
  private enabled: boolean = DEFAULT_CONFIG.enabled
  private maxFileSize: number = DEFAULT_CONFIG.maxFileSize
  private debounceDelay: number = DEFAULT_CONFIG.debounceDelay
  private saturation: number = DEFAULT_CONFIG.saturation
  private lightness: number = DEFAULT_CONFIG.lightness
  // Список плагинов для babel
  private readonly plugins: parser.ParserPlugin[] = BABEL_PLUGINS

  constructor() {
    this.enabled = getEnabled()
    this.maxFileSize = getMaxFileSize()
    this.debounceDelay = getDebounceDelay()
    this.saturation = getSaturation()
    this.lightness = getLightness()

    // Слушатель изменений пользовательской конфигурации
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('colorizeReactTags')) {
        this.enabled = getEnabled()
        this.maxFileSize = getMaxFileSize()
        this.debounceDelay = getDebounceDelay()
        this.saturation = getSaturation()
        this.lightness = getLightness()

        if (this.enabled) {
          this.updateAllEditors()
        } else {
          this.clearAllDecorations()
        }
      }
    })
  }

  public updateDocument(editor: vscode.TextEditor | undefined): void {
    if (!editor || !this.enabled) return

    const document = editor.document

    if (document.getText().length > this.maxFileSize) return

    if (this.idUpdateTimeout) {
      clearTimeout(this.idUpdateTimeout)
    }

    this.idUpdateTimeout = setTimeout(() => {
      this._updateDocument(editor)
    }, this.debounceDelay)
  }

  private _updateDocument(editor: vscode.TextEditor): void {
    const document = editor.document
    const text = document.getText()
    const cacheKey = `${document.uri.toString()}_${document.version}`

    // Если есть кеш, берем из кеша (возможны артефакты)
    if (this.parserCache.has(cacheKey)) {
      const cachedRanges = this.parserCache.get(cacheKey)
      if (cachedRanges) {
        this.applyDecorations(editor, cachedRanges)
        return
      }
    }

    try {
      const tagRanges = this.parseDocument(text, document)
      // Добавляем запись в кеш
      this.parserCache.set(cacheKey, tagRanges)

      // Придерживаемся размера кеша
      if (this.parserCache.size > CACHE_SIZE) {
        const firstKey = this.parserCache.keys().next().value
        if (firstKey) {
          this.parserCache.delete(firstKey)
        }
      }

      this.applyDecorations(editor, tagRanges)
    } catch (error) {
      console.error('Error parsing document:', error)
    }
  }

  private parseDocument(
    text: string,
    document: vscode.TextDocument,
  ): TagRange[] {
    const tagRanges: TagRange[] = []

    try {
      const ast = parser.parse(text, {
        sourceType: 'module',
        plugins: this.plugins,
        errorRecovery: true,
        tokens: false,
      })

      const stack: StackItem[] = []
      let level = 0

      traverse(ast, {
        enter: (path: NodePath) => {
          if (path.isJSXElement()) {
            const openingElement = path.node.openingElement
            const tagName = getTagName(openingElement.name)

            // Обработка открывающего тега/компонента
            if (openingElement.loc) {
              const range = new vscode.Range(
                openingElement.loc.start.line - 1,
                openingElement.loc.start.column,
                openingElement.loc.end.line - 1,
                openingElement.loc.end.column,
              )

              const tagNameRange = extractTagNameRange(document, range, tagName)
              if (tagNameRange) {
                tagRanges.push({
                  range: tagNameRange,
                  level,
                  tagName,
                })
              }
            }

            // Добавляем в стэк открывающий тег/компонент
            stack.push({ tagName, level: level++ })

            // Самозакрывающий тег/компонент
            if (openingElement.selfClosing) {
              stack.pop()
              level--
            }
          }
          // Обработка закрывающего тега/компонента
          if (path.isJSXClosingElement()) {
            const tagName = getTagName(path.node.name)

            if (stack.length > 0) {
              // Выбираем последний открывающий тег/компонент (пару для закрывающего)
              const lastTag = stack.pop()
              level--

              if (path.node.loc) {
                const range = new vscode.Range(
                  path.node.loc.start.line - 1,
                  path.node.loc.start.column,
                  path.node.loc.end.line - 1,
                  path.node.loc.end.column,
                )

                const tagNameRange = extractTagNameRange(
                  document,
                  range,
                  tagName,
                )

                if (tagNameRange) {
                  tagRanges.push({
                    range: tagNameRange,
                    level: lastTag?.level ?? level,
                    tagName,
                  })
                }
              }
            }
          }
          // React фрагменты просто увеличивают уровень вложенности
          // Обработка фрагментов открывающих <>
          if (path.isJSXFragment()) {
            if (path.node.loc) {
              const range = new vscode.Range(
                path.node.loc.start.line - 1,
                path.node.loc.start.column,
                path.node.loc.start.line - 1,
                path.node.loc.start.column + FRAGMENT.OPEN.length,
              )
              tagRanges.push({
                range,
                level,
                tagName: 'Fragment',
              })
            }
            stack.push({ tagName: 'Fragment', level: level++ })
          }
          // Обработка фрагментов закрывающих </>
          if (path.isJSXClosingFragment()) {
            if (stack.length > 0) {
              const lastTag = stack.pop()
              level--

              if (path.node.loc) {
                const range = new vscode.Range(
                  path.node.loc.start.line - 1,
                  path.node.loc.start.column,
                  path.node.loc.start.line - 1,
                  path.node.loc.start.column + FRAGMENT.CLOSE.length,
                )
                tagRanges.push({
                  range,
                  level: lastTag?.level ?? level,
                  tagName: 'Fragment',
                })
              }
            }
          }
        },
      })
    } catch (error) {
      console.error('Babel parse error:', error)
    }

    return tagRanges
  }

  private applyDecorations(
    editor: vscode.TextEditor,
    tagRanges: TagRange[],
  ): void {
    // Если документ без тегов/компонентов
    if (tagRanges.length === 0) {
      this.clearAllDecorations()
      return
    }

    // Группируем теги/компоненты по уровню вложенности
    const rangesByLevel = new Map<number, vscode.Range[]>()

    for (const item of tagRanges) {
      let ranges = rangesByLevel.get(item.level)
      if (!ranges) {
        ranges = []
        rangesByLevel.set(item.level, ranges)
      }
      ranges.push(item.range)
    }
    // Для отслеживания существующих уровней
    const existingLevels = new Set(this.decorationTypes.keys())
    // Применяем или обновляем декорации
    for (const [level, ranges] of rangesByLevel) {
      const color = getColorForLevel(level, this.saturation, this.lightness)

      let decorationType = this.decorationTypes.get(level)
      if (!decorationType) {
        decorationType = vscode.window.createTextEditorDecorationType({
          color,
          rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        })
        this.decorationTypes.set(level, decorationType)
      }
      // Устанавливаем декорации и убираем из существующих
      editor.setDecorations(decorationType, ranges)
      existingLevels.delete(level)
    }
    // Очистка неиспользуемых декораций
    for (const level of existingLevels) {
      const decoration = this.decorationTypes.get(level)
      if (decoration) {
        decoration.dispose()
        this.decorationTypes.delete(level)
      }
    }
  }

  private clearAllDecorations(): void {
    for (const decoration of this.decorationTypes.values()) {
      decoration.dispose()
    }
    this.decorationTypes.clear()
  }

  private updateAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDocument(editor)
    }
  }

  public dispose(): void {
    if (this.idUpdateTimeout) {
      clearTimeout(this.idUpdateTimeout)
    }
    this.clearAllDecorations()
    this.parserCache.clear()
  }
}
