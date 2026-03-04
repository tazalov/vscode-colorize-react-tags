import * as vscode from 'vscode'
import { TagDecorator } from './tagDecorator'

let tagDecorator: TagDecorator

export function activate(context: vscode.ExtensionContext) {
  console.log('Расширение активно!')

  tagDecorator = new TagDecorator()

  // Первый апдейт для всех видимых документов
  vscode.window.visibleTextEditors.forEach((editor) => {
    tagDecorator.updateDocument(editor)
  })

  // Обновляем при изменении активного документа
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      tagDecorator.updateDocument(editor)
    }),
  )

  // Обновляем при внесении изменений в документ
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor
      // Проверяем, что изменения в текущем активном редакторе
      if (editor && event.document === editor.document) {
        tagDecorator.updateDocument(editor)
      }
    }),
  )

  // Очистка кеша при закрытии документа
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument((document) => {
      tagDecorator.clearCacheForDocument(document)
    }),
  )

  // Слушатель изменений конфигурации расширения
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('colorizeReactTags')) {
        // Переинициализируем декоратор при смене конфигурации
        tagDecorator.dispose()
        tagDecorator = new TagDecorator()
        tagDecorator.updateAllEditors()
      }
    }),
  )

  // Добавляем команду для принудительного обновления
  const refreshCommand = vscode.commands.registerCommand(
    'colorizeReactTags.refresh',
    () => {
      tagDecorator.updateAllEditors()
      vscode.window.showInformationMessage('Tag coloring refreshed')
    },
  )

  context.subscriptions.push(refreshCommand)
}

export function deactivate() {
  if (tagDecorator) {
    tagDecorator.dispose()
  }
}
