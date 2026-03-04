import * as parser from '@babel/parser'
import { ExtensionConfig } from './types'

// Данные для фрагметов <></>
export const FRAGMENT = {
  OPEN_LENGTH: 2, // <>
  CLOSE_LENGTH: 3, // </>
} as const
// Размер кеша
export const CACHE_SIZE = 10
// Дефолтные значения для конфигурации
export const DEFAULT_CONFIG: ExtensionConfig = {
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
]
