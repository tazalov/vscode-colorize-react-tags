import * as vscode from 'vscode'
import { StackItem, TagRange } from '../types'
import { HTML_SKIP_ELS, HTML_VOID_ELS } from '../consts'

/**
 * Возвращает `true`, если символ допустим в имени HTML-тега
 * @param c проверяемый символ
 * @returns `true` для `a-z`, `0-9`, `-` и `:`
 */
function isTagNameChar(c: string): boolean {
  return (
    (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '-' || c === ':'
  )
}

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
  document: vscode.TextDocument,
): TagRange[] {
  const tagRanges: TagRange[] = []
  const stack: StackItem[] = []
  let level = 0
  let pos = 0
  const len = text.length
  const lowerText = text.toLowerCase()
  const lineOffsets = buildLineOffsets(text)

  while (pos < len) {
    if (text[pos] !== '<') {
      pos++
      continue
    }

    // Комментарий <!-- -->
    if (text.startsWith('<!--', pos)) {
      const end = text.indexOf('-->', pos + 4)
      pos = end === -1 ? len : end + 3
      continue
    }

    // CDATA <![CDATA[...]]>
    if (text.startsWith('<![CDATA[', pos)) {
      const end = text.indexOf(']]>', pos + 9)
      pos = end === -1 ? len : end + 3
      continue
    }

    // DOCTYPE / processing instruction
    if (text[pos + 1] === '!' || text[pos + 1] === '?') {
      const end = text.indexOf('>', pos + 1)
      pos = end === -1 ? len : end + 1
      continue
    }

    // Закрывающий тег </tagname>
    if (text[pos + 1] === '/') {
      const nameStart = pos + 2
      let nameEnd = nameStart
      while (nameEnd < len && isTagNameChar(lowerText[nameEnd])) nameEnd++
      const tagName = lowerText.slice(nameStart, nameEnd)
      const end = text.indexOf('>', nameEnd)
      pos = end === -1 ? len : end + 1

      if (tagName && stack.length > 0) {
        // Выталкиваем стек только если имя совпадает — иначе уровни «съедут» при невалидном HTML
        if (stack[stack.length - 1].tagName !== tagName) {
          continue
        }
        const lastTag = stack.pop()!
        level--
        level = Math.max(0, level)
        tagRanges.push({
          range: new vscode.Range(
            offsetToPosition(lineOffsets, nameStart),
            offsetToPosition(lineOffsets, nameEnd),
          ),
          level: lastTag.level,
          tagName,
        })
      }
      continue
    }

    // Открывающий тег <tagname ...>
    const nameStart = pos + 1
    let nameEnd = nameStart
    while (nameEnd < len && isTagNameChar(lowerText[nameEnd])) nameEnd++

    if (nameEnd === nameStart) {
      pos++
      continue
    }

    const tagName = lowerText.slice(nameStart, nameEnd)

    // Пропускаем атрибуты, корректно обрабатывая строки в кавычках
    let i = nameEnd
    while (i < len && text[i] !== '>') {
      if (text[i] === '"') {
        i++
        while (i < len && text[i] !== '"') i++
        if (i < len) i++
      } else if (text[i] === "'") {
        i++
        while (i < len && text[i] !== "'") i++
        if (i < len) i++
      } else {
        i++
      }
    }

    // Проверяем self-closing: ищем / перед >
    let j = i - 1
    while (j >= nameEnd && text[j] === ' ') j--
    const isSelfClosed = j >= nameEnd && text[j] === '/'

    pos = i < len ? i + 1 : len

    tagRanges.push({
      range: new vscode.Range(
        offsetToPosition(lineOffsets, nameStart),
        offsetToPosition(lineOffsets, nameEnd),
      ),
      level,
      tagName,
    })

    if (!HTML_VOID_ELS.has(tagName) && !isSelfClosed) {
      stack.push({ tagName, level: level++ })
    }

    // Содержимое <script>, <style>, <textarea> и <xmp> не парсим как HTML-теги
    if (HTML_SKIP_ELS.has(tagName)) {
      const closeIdx = lowerText.indexOf(`</${tagName}`, pos)
      pos = closeIdx !== -1 ? closeIdx : len
    }
  }

  return tagRanges
}
