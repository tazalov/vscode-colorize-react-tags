import {
  JSXIdentifier,
  JSXMemberExpression,
  JSXNamespacedName,
} from '@babel/types'
import * as vscode from 'vscode'

/**
 * Функция генерации пастельных цветов
 * @param level уровень вложенности
 * @param saturation насыщенность
 * @param lightness яркость
 * @returns hsl цвет
 */
export function getColorForLevel(
  level: number,
  saturation: number,
  lightness: number,
): string {
  const hue = (level * 60) % 360

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

/**
 * Функция получения названия тега/компонента из AST ноды
 * @param name поле name из AST ноды
 * @returns название тега/компонента
 */
export function getTagName(
  name: JSXIdentifier | JSXMemberExpression | JSXNamespacedName,
): string {
  if (!name) return 'unknown'

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
export function extractTagNameRange(
  document: vscode.TextDocument,
  fullRange: vscode.Range,
  tagName: string,
): vscode.Range | null {
  // Тег/компонент открыт и закрыт на одной строке
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
  }

  // Тег/компонент открыт и закрыт на разных строках
  const text = document.getText(fullRange)
  const tagNameIdx = text.indexOf(tagName)

  if (tagNameIdx !== -1) {
    return new vscode.Range(
      fullRange.start.line,
      fullRange.start.character + tagNameIdx,
      fullRange.start.line,
      fullRange.start.character + tagNameIdx + tagName.length,
    )
  }

  return fullRange
}
