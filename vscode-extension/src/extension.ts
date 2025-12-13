import * as vscode from 'vscode';

// 插件激活入口
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "auto-language-switch" is now active!');

    // 注册一个命令，用于测试或手动开关
    let disposable = vscode.commands.registerCommand('auto-language-switch.toggle', () => {
        vscode.window.showInformationMessage('Auto Language Switch Toggled!');
    });

    context.subscriptions.push(disposable);

    // 核心逻辑：监听光标移动事件
    // onDidChangeTextEditorSelection 是高频事件，我们需要在后续加上防抖(debounce)
    vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor.document.languageId === 'log') {
            return; // 忽略日志文件
        }
        
        // 获取当前光标位置
        const position = event.selections[0].active;
        
        // 这里的逻辑将在后续连接 Native Sidecar 后完善
        // 目前我们只简单打印光标位置，验证事件触发正常
        // console.log(`Cursor at: Line ${position.line}, Char ${position.character}`);
    });
}

// 插件停用出口
export function deactivate() {}
