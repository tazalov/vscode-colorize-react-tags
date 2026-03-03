import * as vscode from 'vscode'
import { ExtensionConfig } from './types'

/**
 * Получение конфигурации расширения (из пользовательского конфига)
 * @returns объект конфигурации
 */
export function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('colorizeReactTags')
  return {
    enabled: config.get<boolean>('enabled', true),
    maxFileSize: config.get<number>('maxFileSize', 100000),
    debounceDelay: config.get<number>('debounceDelay', 300),
    saturation: config.get<number>('saturation', 60),
    lightness: config.get<number>('lightness', 60),
  }
}
