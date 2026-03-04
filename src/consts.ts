import * as parser from '@babel/parser'

// Данные для фрагметов <></>
export const FRAGMENT = {
  OPEN: { text: '<>', length: 2 },
  CLOSE: { text: '</>', length: 3 },
} as const
// Размер кеша
export const CACHE_SIZE = 10
// Дефолтные значения для конфигурации
export const DEFAULT_CONFIG = {
  enabled: true,
  maxFileSize: 100000,
  debounceDelay: 300,
  saturation: 60,
  lightness: 60,
}
// Список плагинов для babel
export const BABEL_PLUGINS: parser.ParserPlugin[] = ['jsx', 'typescript']
// Поддерживаемые языки для обработки
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact',
] as const
