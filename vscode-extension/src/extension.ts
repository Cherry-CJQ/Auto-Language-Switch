import * as vscode from 'vscode';
import { SidecarClient } from './sidecar';

let sidecar: SidecarClient;
let lastMode: 'code' | 'comment' | 'unknown' = 'unknown';

export function activate(context: vscode.ExtensionContext) {
    console.log('ALS (Native Switching Mode) activated.');

    sidecar = new SidecarClient();
    sidecar.start();

    // 监听 Sidecar 输出，用于捕获 list 结果
    // 注意：我们需要一个机制来知道什么时候是 list 的结果
    sidecar.onMessage((json) => {
        if (json.data && Array.isArray(json.data)) {
            // 如果收到了列表数据，启动选择流程
            handleSetupProcess(json.data);
        }
    });

    // 1. 注册主 Toggle 命令
    context.subscriptions.push(vscode.commands.registerCommand('auto-language-switch.toggle', () => {
        const enLayout = vscode.workspace.getConfiguration('autoLanguageSwitch').get<string>('englishLayout', '00000409');
        sidecar.send('switch', enLayout);
        vscode.window.showInformationMessage(`Sent switch request: ${enLayout}`);
    }));

    // 2. 注册配置向导命令
    context.subscriptions.push(vscode.commands.registerCommand('auto-language-switch.setup', () => {
        vscode.window.showInformationMessage("Fetching installed keyboards...");
        sidecar.send('list', '');
    }));

    // 3. 监听光标移动 (核心业务)
    let selectionDisposable = vscode.window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor.document.languageId === 'log') return;
        
        const editor = event.textEditor;
        const position = event.selections[0].active;
        
        const currentMode = getScopeMode(editor.document, position);
        
        if (currentMode !== lastMode && currentMode !== 'unknown') {
            lastMode = currentMode;
            
            const config = vscode.workspace.getConfiguration('autoLanguageSwitch');
            const targetLayout = currentMode === 'code' 
                ? config.get<string>('englishLayout', '00000409')
                : config.get<string>('chineseLayout', '00000804');
            
            sidecar.send('switch', targetLayout);
        }
    });

    context.subscriptions.push(selectionDisposable);
}

interface LayoutInfo {
    id: string;
    name: string;
}

// 配置向导流程
async function handleSetupProcess(rawLayouts: any[]) {
    // 转换数据结构
    const items: vscode.QuickPickItem[] = rawLayouts.map((item: LayoutInfo) => ({
        label: item.name, // 显示名称 (如 "English (US)")
        description: item.id, // 显示 ID (如 "04090409")
        detail: `ID: ${item.id}`
    }));

    // 1. 选择英文输入法
    const enPick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select your ENGLISH input method',
        title: 'Step 1/2: Setup English Layout'
    });
    if (!enPick) return;

    // 2. 选择中文输入法
    const cnPick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select your CHINESE input method',
        title: 'Step 2/2: Setup Chinese Layout'
    });
    if (!cnPick) return;

    // 3. 自动保存到配置
    const config = vscode.workspace.getConfiguration('autoLanguageSwitch');
    // 注意：我们需要保存的是 ID (description)
    await config.update('englishLayout', enPick.description, vscode.ConfigurationTarget.Global);
    await config.update('chineseLayout', cnPick.description, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(`Setup Complete! EN: ${enPick.label}, CN: ${cnPick.label}`);
}

function getScopeMode(document: vscode.TextDocument, position: vscode.Position): 'code' | 'comment' | 'unknown' {
    const lineText = document.lineAt(position.line).text;
    const prefix = lineText.substring(0, position.character);

    if (prefix.includes('//') || prefix.includes('#')) {
        return 'comment';
    }

    const doubleQuotes = (prefix.match(/"/g) || []).length;
    const singleQuotes = (prefix.match(/'/g) || []).length;
    if (doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) {
        return 'comment';
    }

    return 'code';
}

export function deactivate() {
    if (sidecar) {
        sidecar.stop();
    }
}
