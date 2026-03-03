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

  // Добавляем обработку видимых редакторов при изменении конфигурации
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('colorizeReactTags')) {
        // Принудительно обновляем все видимые редакторы
        vscode.window.visibleTextEditors.forEach((editor) => {
          tagDecorator.updateDocument(editor)
        })
      }
    }),
  )

  // TODO Добавляем обработку закрытия редакторов для очистки кэша
  // context.subscriptions.push(
  //   vscode.window.onDidChangeVisibleTextEditors((editors) => {}),
  // )

  // Добавляем команду для принудительного обновления
  const refreshCommand = vscode.commands.registerCommand(
    'colorizeReactTags.refresh',
    () => {
      vscode.window.visibleTextEditors.forEach((editor) => {
        tagDecorator.updateDocument(editor)
      })
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
