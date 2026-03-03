import * as vscode from 'vscode'

export interface TagRange {
  range: vscode.Range
  level: number
  tagName: string
}

export interface StackItem {
  tagName: string
  level: number
}

export interface ExtensionConfig {
  enabled: boolean
  maxFileSize: number
  debounceDelay: number
  saturation: number
  lightness: number
}
