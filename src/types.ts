import * as vscode from 'vscode'

export interface TagRange {
  range: vscode.Range
  level: number
  tagName: string
  pairIdx: number
}

export interface StackItem {
  tagName: string
  level: number
  pairIdx: number
}

export interface ExtensionConfig {
  enabled: boolean
  maxFileSize: number
  debounceDelay: number
  saturation: number
  lightness: number
  colorMode: 'nesting' | 'sequential'
}
