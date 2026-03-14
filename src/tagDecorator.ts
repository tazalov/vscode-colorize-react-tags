import * as vscode from 'vscode'
import { getColorForLevel } from './utils'
import { TagRange } from './types'
import { CACHE_SIZE, DEFAULT_CONFIG, SUPPORTED_LANGUAGES } from './consts'
import { getConfig } from './config'
import { parseHtml, parseJsx } from './parsers'

export class TagDecorator {
  // Список декораций
  private decorationTypes: Map<number, vscode.TextEditorDecorationType> =
    new Map()
  // Кеш парсера
  private parserCache: Map<string, TagRange[]> = new Map()
  // id таймаутов для дебаунса обновления документов (по URI)
  private updateTimeouts: Map<string, NodeJS.Timeout> = new Map()
  // Конфигурация расширения
  private enabled: boolean = DEFAULT_CONFIG.enabled
  private maxFileSize: number = DEFAULT_CONFIG.maxFileSize
  private debounceDelay: number = DEFAULT_CONFIG.debounceDelay
  private saturation: number = DEFAULT_CONFIG.saturation
  private lightness: number = DEFAULT_CONFIG.lightness

  constructor() {
    this.updateConfig()
  }

  private updateConfig() {
    const config = getConfig()

    this.enabled = config.enabled
    this.maxFileSize = config.maxFileSize
    this.debounceDelay = config.debounceDelay
    this.saturation = config.saturation
    this.lightness = config.lightness
  }

  public updateDocument(editor: vscode.TextEditor | undefined): void {
    if (!editor || !this.enabled) return

    const document = editor.document

    // Обрабатываем только известные JS/TS/JSX/TSX документы, чтобы избежать ненужного парсинга
    if (!SUPPORTED_LANGUAGES.has(document.languageId)) return

    const uri = document.uri.toString()
    const existingTimeout = this.updateTimeouts.get(uri)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const timeout = setTimeout(() => {
      this.updateTimeouts.delete(uri)
      this._updateDocument(editor)
    }, this.debounceDelay)
    this.updateTimeouts.set(uri, timeout)
  }

  private _updateDocument(editor: vscode.TextEditor): void {
    // Проверяем, что редактор ещё открыт и видим (предотвращает race condition)
    if (!vscode.window.visibleTextEditors.includes(editor)) {
      return
    }

    const document = editor.document
    const text = document.getText()

    // Ограничение по размеру документа (количество символов)
    if (text.length > this.maxFileSize) return

    const cacheKey = `${document.uri.toString()}_${document.version}`

    // Если есть кеш, берем из кеша
    const cachedRanges = this.parserCache.get(cacheKey)
    if (cachedRanges) {
      this.applyDecorations(editor, cachedRanges)
      return
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
    if (document.languageId === 'html') {
      return parseHtml(text, document)
    }
    return parseJsx(text, document)
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

  public updateAllEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDocument(editor)
    }
  }

  // Очистка кеша при закрытии документа (предотвращает memory leak)
  public clearCacheForDocument(document: vscode.TextDocument): void {
    const uri = document.uri.toString()
    const timeout = this.updateTimeouts.get(uri)
    if (timeout) {
      clearTimeout(timeout)
      this.updateTimeouts.delete(uri)
    }
    for (const key of this.parserCache.keys()) {
      if (key.startsWith(uri)) {
        this.parserCache.delete(key)
      }
    }
  }

  public dispose(): void {
    for (const timeout of this.updateTimeouts.values()) {
      clearTimeout(timeout)
    }
    this.updateTimeouts.clear()
    this.clearAllDecorations()
    this.parserCache.clear()
  }
}
