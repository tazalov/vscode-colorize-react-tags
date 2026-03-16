import * as vscode from 'vscode'
import * as parser from '@babel/parser'
import traverse, { NodePath } from '@babel/traverse'
import {
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
  JSXElement as JSXElementNode,
  JSXFragment as JSXFragmentNode,
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

export function parseJsx(
  text: string,
  _document: vscode.TextDocument,
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
      JSXElement: {
        enter: (path: NodePath<JSXElementNode>) => {
          const { openingElement } = path.node
          const tagName = getTagName(openingElement.name)
          const pairIdx = pairCounter++

          // Имя тега всегда начинается сразу после '<' (column + 1)
          if (openingElement.loc) {
            const { start } = openingElement.loc
            tagRanges.push({
              range: new vscode.Range(
                start.line - 1,
                start.column + 1,
                start.line - 1,
                start.column + 1 + tagName.length,
              ),
              level,
              tagName,
              pairIdx,
            })
          }

          stack.push({ tagName, level: level++, pairIdx })
          // Самозакрывающий тег — сразу снимаем со стека
          if (openingElement.selfClosing) {
            stack.pop()
            level = Math.max(0, level - 1)
          }
        },
        exit: (path: NodePath<JSXElementNode>) => {
          // Самозакрывающие уже обработаны в enter
          if (path.node.openingElement.selfClosing || stack.length === 0) return
          const lastTag = stack.pop()!
          level = Math.max(0, level - 1)

          // Имя закрывающего тега начинается после '</' (column + 2)
          const { closingElement } = path.node
          if (closingElement?.loc) {
            const { start } = closingElement.loc
            tagRanges.push({
              range: new vscode.Range(
                start.line - 1,
                start.column + 2,
                start.line - 1,
                start.column + 2 + lastTag.tagName.length,
              ),
              level: lastTag.level,
              tagName: lastTag.tagName,
              pairIdx: lastTag.pairIdx,
            })
          }
        },
      },
      JSXFragment: {
        enter: (path: NodePath<JSXFragmentNode>) => {
          const pairIdx = pairCounter++
          if (path.node.loc) {
            const { start } = path.node.loc
            tagRanges.push({
              range: new vscode.Range(
                start.line - 1,
                start.column,
                start.line - 1,
                start.column + FRAGMENT.OPEN_LENGTH,
              ),
              level,
              tagName: 'Fragment',
              pairIdx,
            })
          }
          stack.push({ tagName: 'Fragment', level: level++, pairIdx })
        },
        exit: (path: NodePath<JSXFragmentNode>) => {
          if (stack.length === 0) return
          const lastTag = stack.pop()!
          level = Math.max(0, level - 1)

          const { closingFragment } = path.node
          if (closingFragment.loc) {
            const { start } = closingFragment.loc
            tagRanges.push({
              range: new vscode.Range(
                start.line - 1,
                start.column,
                start.line - 1,
                start.column + FRAGMENT.CLOSE_LENGTH,
              ),
              level: lastTag.level,
              tagName: 'Fragment',
              pairIdx: lastTag.pairIdx,
            })
          }
        },
      },
    })
  } catch (error) {
    console.error('Babel parse error:', error)
  }

  return tagRanges
}
