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
