/**
 * GDShader Support 插件入口
 * 注册所有语言功能: 补全, 悬停, 诊断, 格式化, 颜色预览, 命令等.
 * 创建共享的 DocumentManager, 注入各 provider.
 */
import * as vscode from 'vscode';
import { DocumentManager } from './providers/document-manager';
import { GDShaderCompletionProvider } from './providers/completionProvider';
import { GDShaderHoverProvider } from './providers/hoverProvider';
import { GDShaderDiagnosticsProvider } from './providers/diagnosticsProvider';
import { GDShaderDocumentFormattingProvider } from './providers/formattingProvider';
import { GDShaderColorProvider } from './providers/colorProvider';
import { GDShaderDefinitionProvider } from './providers/definitionProvider';
import { GDShaderRenameProvider } from './providers/renameProvider';
import { GDShaderSemanticTokensProvider, SEMANTIC_TOKENS_LEGEND } from './providers/semanticTokensProvider';
import { registerCommands } from './commands';
import { loc } from './loc';

const GDSHADER_SELECTOR: vscode.DocumentSelector = { language: 'gdshader', scheme: 'file' };

/** 插件激活时调用 */
export function activate(context: vscode.ExtensionContext) {
  console.log(loc('ext.activated'));

  const config = vscode.workspace.getConfiguration('gdshader');
  const docManager = new DocumentManager();

  // 文档变更时更新 AST 缓存
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.languageId === 'gdshader') {
        docManager.update(e.document.uri.toString(), e.document.getText());
      }
    }),
    vscode.workspace.onDidOpenTextDocument(doc => {
      if (doc.languageId === 'gdshader') {
        docManager.update(doc.uri.toString(), doc.getText());
      }
    }),
    vscode.workspace.onDidCloseTextDocument(doc => {
      docManager.delete(doc.uri.toString());
    })
  );

  // 立即解析当前已打开的文件
  if (vscode.window.activeTextEditor?.document.languageId === 'gdshader') {
    const doc = vscode.window.activeTextEditor.document;
    docManager.update(doc.uri.toString(), doc.getText());
  }

  // 代码补全
  if (config.get<boolean>('completion.enabled', true)) {
    context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        GDSHADER_SELECTOR,
        new GDShaderCompletionProvider(docManager),
        '.'
      )
    );
  }

  // 悬停提示
  if (config.get<boolean>('hover.enabled', true)) {
    context.subscriptions.push(
      vscode.languages.registerHoverProvider(
        GDSHADER_SELECTOR,
        new GDShaderHoverProvider(docManager)
      )
    );
  }

  // 跳转到定义 (F12 / Ctrl+Click)
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      GDSHADER_SELECTOR,
      new GDShaderDefinitionProvider(docManager)
    )
  );

  // 重命名符号 (F2)
  context.subscriptions.push(
    vscode.languages.registerRenameProvider(
      GDSHADER_SELECTOR,
      new GDShaderRenameProvider(docManager)
    )
  );

  // 语法诊断
  if (config.get<boolean>('diagnostics.enabled', true)) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('gdshader');
    const diagnosticsProvider = new GDShaderDiagnosticsProvider(diagnosticCollection, docManager);
    context.subscriptions.push(diagnosticCollection);

    if (vscode.window.activeTextEditor?.document.languageId === 'gdshader') {
      diagnosticsProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.languageId === 'gdshader') {
          diagnosticsProvider.updateDiagnostics(e.document);
        }
      }),
      vscode.workspace.onDidOpenTextDocument(doc => {
        if (doc.languageId === 'gdshader') {
          diagnosticsProvider.updateDiagnostics(doc);
        }
      }),
      vscode.workspace.onDidCloseTextDocument(doc => {
        diagnosticCollection.delete(doc.uri);
      })
    );
  }

  // 文档格式化
  if (config.get<boolean>('format.enabled', true)) {
    context.subscriptions.push(
      vscode.languages.registerDocumentFormattingEditProvider(
        GDSHADER_SELECTOR,
        new GDShaderDocumentFormattingProvider()
      )
    );
  }

  // 颜色预览
  context.subscriptions.push(
    vscode.languages.registerColorProvider(GDSHADER_SELECTOR, new GDShaderColorProvider())
  );

  // 语义高亮 (struct 类型名)
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      GDSHADER_SELECTOR,
      new GDShaderSemanticTokensProvider(docManager),
      SEMANTIC_TOKENS_LEGEND
    )
  );

  // 注册命令
  registerCommands(context);
}

/** 插件停用时调用 */
export function deactivate() {
  // 清理资源
}
