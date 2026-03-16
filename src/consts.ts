import * as parser from '@babel/parser'
import { ExtensionConfig } from './types'

// Данные для фрагметов <></>
export const FRAGMENT = {
  OPEN_LENGTH: 2, // <>
  CLOSE_LENGTH: 3, // </>
} as const
// Размер кеша
export const CACHE_SIZE = 50
// Дефолтные значения для конфигурации
export const DEFAULT_CONFIG: ExtensionConfig = {
  enabled: true,
  maxFileSize: 100000,
  debounceDelay: 300,
  saturation: 60,
  lightness: 60,
  colorMode: 'nesting',
}
// Список плагинов для babel
export const BABEL_PLUGINS: parser.ParserPlugin[] = ['jsx', 'typescript']
// Поддерживаемые языки для обработки
export const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
  'html',
])
// Void-элементы HTML (не имеют закрывающего тега)
export const HTML_VOID_ELS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])
export const HTML_SKIP_ELS = new Set(['script', 'style', 'textarea', 'xmp'])
