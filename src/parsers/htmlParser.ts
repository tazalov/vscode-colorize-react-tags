import * as vscode from 'vscode'
import { Parser } from 'htmlparser2'
import { StackItem, TagRange } from '../types'

/**
 * Строит массив байтовых смещений начала каждой строки за O(n)
 * @param text исходный текст документа
 * @returns массив смещений, где `offsets[i]` — начало i-й строки
 */
function buildLineOffsets(text: string): number[] {
  const offsets = [0]
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') offsets.push(i + 1)
  }
  return offsets
}

/**
 * Переводит байтовое смещение в `vscode.Position` бинарным поиском по таблице `offsets` за O(log n)
 * @param offsets таблица смещений строк, полученная из `buildLineOffsets`
 * @param offset байтовое смещение в тексте документа
 * @returns позиция в документе (строка и столбец)
 */
function offsetToPosition(offsets: number[], offset: number): vscode.Position {
  let lo = 0
  let hi = offsets.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return new vscode.Position(lo, offset - offsets[lo])
}

export function parseHtml(
  text: string,
  _document: vscode.TextDocument,
): TagRange[] {
  const tagRanges: TagRange[] = []
  const stack: StackItem[] = []
  let level = 0
  let pairCounter = 0
  const lineOffsets = buildLineOffsets(text)

  const parser = new Parser({
    onopentag(name: string) {
      // parser.startIndex указывает на '<', имя тега начинается сразу после
      const nameStart = parser.startIndex + 1
      const nameEnd = nameStart + name.length
      const currentPairIdx = pairCounter++
      tagRanges.push({
        range: new vscode.Range(
          offsetToPosition(lineOffsets, nameStart),
          offsetToPosition(lineOffsets, nameEnd),
        ),
        level,
        tagName: name,
        pairIdx: currentPairIdx,
      })
      stack.push({ tagName: name, level: level++, pairIdx: currentPairIdx })
    },

    onclosetag(name: string, isImplied: boolean) {
      // Всегда вытягиваем стек для корректной работы с void-элементами, неявными закрытиями
      // и HTML5-восстановлением, когда htmlparser2 закрывает теги автоматически
      if (stack.length > 0 && stack[stack.length - 1].tagName === name) {
        const lastTag = stack.pop()! // Всегда есть, т.к. есть проверка на length > 0
        level = Math.max(0, level - 1)

        // Записываем диапазон только для явных закрывающих тегов, присутствующих в источнике
        if (!isImplied) {
          // parser.startIndex указывает на '<', имя начинается после '</'
          const nameStart = parser.startIndex + 2
          const nameEnd = nameStart + name.length
          tagRanges.push({
            range: new vscode.Range(
              offsetToPosition(lineOffsets, nameStart),
              offsetToPosition(lineOffsets, nameEnd),
            ),
            level: lastTag.level,
            tagName: name,
            pairIdx: lastTag.pairIdx,
          })
        }
      }
    },
  })

  parser.write(text)
  parser.end()

  return tagRanges
}
