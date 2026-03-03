import * as vscode from 'vscode'

/**
 * Получение состояния вкл/выкл работы расширения (из конфига)
 * @returns
 */
export function getEnabled(): boolean {
  const config = vscode.workspace.getConfiguration('colorizeReactTags')
  return config.get<boolean>('enabled', true)
}
/**
 * Получение максимального размера файла (из конфига)
 * @returns размер файла в байтах
 */
export function getMaxFileSize(): number {
  const config = vscode.workspace.getConfiguration('colorizeReactTags')
  return config.get<number>('maxFileSize', 100000)
}

/**
 * Получение задержки обновления пересчета цветов при изменении документа (из конфига)
 * @returns delay (ms)
 */
export function getDebounceDelay(): number {
  const config = vscode.workspace.getConfiguration('colorizeReactTags')
  return config.get<number>('debounceDelay', 300)
}

/**
 * Получение уровня насыщенности цвета (из конфига)
 * @returns насыщенность (0-100)
 */
export function getSaturation(): number {
  const config = vscode.workspace.getConfiguration('colorizeReactTags')
  return config.get<number>('saturation', 60)
}

/**
 * Получение уровня яркости цвета (из конфига)
 * @returns ясркость (0-100)
 */
export function getLightness(): number {
  const config = vscode.workspace.getConfiguration('colorizeReactTags')
  return config.get<number>('lightness', 60)
}
