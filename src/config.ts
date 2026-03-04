import * as vscode from 'vscode'
import { ExtensionConfig } from './types'

/**
 * Получение конфигурации расширения (из пользовательского конфига)
 * @returns объект конфигурации
 */
export function getConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('colorizeReactTags')

  const maxFileSize = Math.max(100, config.get<number>('maxFileSize', 100000))
  const debounceDelay = Math.max(100, config.get<number>('debounceDelay', 300))
  const saturation = Math.min(
    100,
    Math.max(0, config.get<number>('saturation', 60)),
  )
  const lightness = Math.min(
    100,
    Math.max(0, config.get<number>('lightness', 60)),
  )

  return {
    enabled: config.get<boolean>('enabled', true),
    maxFileSize,
    debounceDelay,
    saturation,
    lightness,
  }
}
