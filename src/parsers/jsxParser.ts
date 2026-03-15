import * as vscode from 'vscode'
import * as parser from '@babel/parser'
import traverse, { NodePath } from '@babel/traverse'
import {
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
} from '@babel/types'

import { StackItem, TagRange } from '../types'
import { BABEL_PLUGINS, FRAGMENT } from '../consts'

/**
 * Функция получения названия тега/компонента из AST ноды
 * @param name поле name из AST ноды
 * @returns название тега/компонента
 */
function getTagName(
  name: JSXIdentifier | JSXMemberExpression | JSXNamespacedName,
): string {
  switch (name.type) {
    case 'JSXIdentifier':
      return name.name
    case 'JSXMemberExpression':
      return `${getTagName(name.object)}.${getTagName(name.property)}`
    case 'JSXNamespacedName':
      return `${name.namespace.name}:${name.name.name}`
    default:
      return 'unknown'
  }
}

/**
 * Функция извлечения имени ОТКРЫВАЮЩЕГО тега/компонента из документа
 * @param document документ VSCode
 * @param fullRange vscode.Range с начальным и конечным позициями тега/компонента
 * @param tagName название тега/компонента
 * @returns vscode.Range с начальным и конечным позициями название тега/компонента
 */
function extractTagNameRange(
  document: vscode.TextDocument,
  fullRange: vscode.Range,
  tagName: string,
): vscode.Range | null {
  // Однострочный тег/компонент
  if (fullRange.start.line === fullRange.end.line) {
    const line = document.lineAt(fullRange.start.line)
    const lineText = line.text
    const tagStart = lineText.indexOf(tagName, fullRange.start.character)

    if (tagStart !== -1 && tagStart < fullRange.end.character) {
      return new vscode.Range(
        fullRange.start.line,
        tagStart,
        fullRange.start.line,
        tagStart + tagName.length,
      )
    }

    return null
  }

  // Многострочный: находим `tagName` относительно `fullRange` с помощью смещений документа
  const text = document.getText(fullRange)
  const tagNameIdx = text.indexOf(tagName)

  if (tagNameIdx !== -1) {
    const fullRangeStartOffset = document.offsetAt(fullRange.start)
    const startOffset = fullRangeStartOffset + tagNameIdx
    const startPos = document.positionAt(startOffset)
    const endPos = document.positionAt(startOffset + tagName.length)
    return new vscode.Range(startPos, endPos)
  }

  return null
}

export function parseJsx(
  text: string,
  document: vscode.TextDocument,
): TagRange[] {
  const tagRanges: TagRange[] = []

  try {
    const ast = parser.parse(text, {
      sourceType: 'module',
      plugins: BABEL_PLUGINS,
      errorRecovery: true,
      tokens: false,
    })

    const stack: StackItem[] = []
    let level = 0
    let pairCounter = 0

    traverse(ast, {
      JSXExpressionContainer: {
        enter: (path: NodePath) => {
          // Повышаем level для компонентов, переданных как props
          if (path.parent.type === 'JSXAttribute') {
            level++
          }
        },
        exit: (path: NodePath) => {
          // Понижаем level при выходе из props
          if (path.parent.type === 'JSXAttribute') {
            level = Math.max(0, level - 1)
          }
        },
      },
      enter: (path: NodePath) => {
        if (path.isJSXElement()) {
          const openingElement = path.node.openingElement
          const tagName = getTagName(openingElement.name)
          const currentPairIdx = pairCounter++

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
                pairIdx: currentPairIdx,
              })
            }
          }

          // Добавляем в стэк открывающий тег/компонент
          stack.push({ tagName, level: level++, pairIdx: currentPairIdx })

          // Самозакрывающий тег/компонент
          if (openingElement.selfClosing) {
            stack.pop()
            level--
            level = Math.max(0, level)
          }
        }
        // Обработка закрывающего тега/компонента
        if (path.isJSXClosingElement()) {
          const tagName = getTagName(path.node.name)

          if (stack.length > 0) {
            // Выбираем последний открывающий тег/компонент (пару для закрывающего)
            const lastTag = stack.pop()! // Всегда есть, т.к. есть проверка на length > 0
            level--
            level = Math.max(0, level)

            if (path.node.loc) {
              const range = new vscode.Range(
                path.node.loc.start.line - 1,
                path.node.loc.start.column,
                path.node.loc.end.line - 1,
                path.node.loc.end.column,
              )

              const tagNameRange = extractTagNameRange(document, range, tagName)
              if (tagNameRange) {
                tagRanges.push({
                  range: tagNameRange,
                  level: lastTag.level,
                  tagName,
                  pairIdx: lastTag.pairIdx,
                })
              }
            }
          }
        }
        // React фрагменты просто увеличивают уровень вложенности
        // Обработка фрагментов открывающих <>
        if (path.isJSXFragment()) {
          const currentPairIdx = pairCounter++
          if (path.node.loc) {
            const range = new vscode.Range(
              path.node.loc.start.line - 1,
              path.node.loc.start.column,
              path.node.loc.start.line - 1,
              path.node.loc.start.column + FRAGMENT.OPEN_LENGTH,
            )
            tagRanges.push({
              range,
              level,
              tagName: 'Fragment',
              pairIdx: currentPairIdx,
            })
          }
          stack.push({
            tagName: 'Fragment',
            level: level++,
            pairIdx: currentPairIdx,
          })
        }
        // Обработка фрагментов закрывающих </>
        if (path.isJSXClosingFragment()) {
          if (stack.length > 0) {
            const lastTag = stack.pop()! // Всегда есть, т.к. есть проверка на length > 0
            level--
            level = Math.max(0, level)

            if (path.node.loc) {
              const range = new vscode.Range(
                path.node.loc.start.line - 1,
                path.node.loc.start.column,
                path.node.loc.start.line - 1,
                path.node.loc.start.column + FRAGMENT.CLOSE_LENGTH,
              )
              tagRanges.push({
                range,
                level: lastTag.level,
                tagName: 'Fragment',
                pairIdx: lastTag.pairIdx,
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
