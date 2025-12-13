import * as vscode from 'vscode';
import { SidecarClient } from './sidecar';

let sidecar: SidecarClient;
let lastMode: 'code' | 'comment' | 'unknown' = 'unknown';

export function activate(context: vscode.ExtensionContext) {
    console.log('ALS (Native Switching Mode) activated.');

    sidecar = new SidecarClient(context);
    sidecar.start();

    sidecar.onMessage((json) => {
        if (json.data && Array.isArray(json.data)) {
            handleSetupProcess(json.data);
        }
    });

    context.subscriptions.push(vscode.commands.registerCommand('auto-language-switch.toggle', () => {
        const enLayout = vscode.workspace.getConfiguration('autoLanguageSwitch').get<string>('englishLayout', '00000409');
        sidecar.send('switch', enLayout);
        vscode.window.showInformationMessage(`Sent switch request: ${enLayout}`);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('auto-language-switch.setup', () => {
        vscode.window.showInformationMessage("Fetching installed keyboards...");
        sidecar.send('list', '');
    }));

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

async function handleSetupProcess(rawLayouts: any[]) {
    const items: vscode.QuickPickItem[] = rawLayouts.map((item: LayoutInfo) => ({
        label: item.name, 
        description: item.id, 
        detail: `ID: ${item.id}`
    }));

    const enPick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select your ENGLISH input method',
        title: 'Step 1/2: Setup English Layout'
    });
    if (!enPick) return;

    const cnPick = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select your CHINESE input method',
        title: 'Step 2/2: Setup Chinese Layout'
    });
    if (!cnPick) return;

    const config = vscode.workspace.getConfiguration('autoLanguageSwitch');
    await config.update('englishLayout', enPick.description, vscode.ConfigurationTarget.Global);
    await config.update('chineseLayout', cnPick.description, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage(`Setup Complete! EN: ${enPick.label}, CN: ${cnPick.label}`);
}

// 语言特定的注释配置
interface LanguageConfig {
    line: string[];
    block: [string, string][]; // [Start, End]
}

const DEFAULT_CONFIG: LanguageConfig = { line: ['//'], block: [['/*', '*/']] };

const LANGUAGE_CONFIGS: { [key: string]: LanguageConfig } = {
    // C-style (C, C++, C#, Java, JS, TS, Rust, Go, Swift, Kotlin, PHP, Scala, Dart...)
    'c': DEFAULT_CONFIG, 'cpp': DEFAULT_CONFIG, 'csharp': DEFAULT_CONFIG,
    'java': DEFAULT_CONFIG, 'javascript': DEFAULT_CONFIG, 'typescript': DEFAULT_CONFIG,
    'javascriptreact': DEFAULT_CONFIG, 'typescriptreact': DEFAULT_CONFIG,
    'rust': DEFAULT_CONFIG, 'go': DEFAULT_CONFIG, 'swift': DEFAULT_CONFIG,
    'kotlin': DEFAULT_CONFIG, 'php': DEFAULT_CONFIG, 'scala': DEFAULT_CONFIG,
    'dart': DEFAULT_CONFIG, 'groovy': DEFAULT_CONFIG, 'objective-c': DEFAULT_CONFIG,
    'less': DEFAULT_CONFIG, 'scss': DEFAULT_CONFIG, 'jsonc': DEFAULT_CONFIG,

    // Script-style (Python, Shell, YAML, Ruby, Perl...)
    'python': { line: ['#'], block: [['"""', '"""'], ["'''", "'''"]] },
    'shellscript': { line: ['#'], block: [] },
    'yaml': { line: ['#'], block: [] },
    'dockerfile': { line: ['#'], block: [] },
    'makefile': { line: ['#'], block: [] },
    'perl': { line: ['#'], block: [['=begin', '=cut']] },
    'ruby': { line: ['#'], block: [['=begin', '=end']] },
    'powershell': { line: ['#'], block: [['<#', '#>']] },
    'r': { line: ['#'], block: [] },

    // Web (HTML, XML, Markdown)
    'html': { line: [], block: [['<!--', '-->']] },
    'xml': { line: [], block: [['<!--', '-->']] },
    'svg': { line: [], block: [['<!--', '-->']] },
    'markdown': { line: [], block: [['<!--', '-->']] },
    'css': { line: [], block: [['/*', '*/']] },
    'vue': { line: ['//'], block: [['/*', '*/'], ['<!--', '-->']] }, // Vue 混合

    // Others
    'lua': { line: ['--'], block: [['--[[', ']]']] },
    'sql': { line: ['--'], block: [['/*', '*/']] },
    'haskell': { line: ['--'], block: [['{-', '-}']] },
    'latex': { line: ['%'], block: [] },
    'tex': { line: ['%'], block: [] },
    'clojure': { line: [';'], block: [] },
    'lisp': { line: [';'], block: [] },
    'scheme': { line: [';'], block: [] },
    'racket': { line: [';'], block: [] },
    'bat': { line: ['REM', '::'], block: [] },
    'vb': { line: ["'"], block: [] },
    
    // Scientific / Old School
    'matlab': { line: ['%'], block: [['%{', '%}']] },
    'erlang': { line: ['%'], block: [] },
    'fortran': { line: ['!'], block: [] }, // Modern Fortran
    'fortran_fixed-form': { line: ['c', '*', '!'], block: [] },
    'pascal': { line: ['//'], block: [['(*', '*)'], ['{', '}']] },
    
    // Config files
    'ini': { line: [';', '#'], block: [] },
    'properties': { line: ['#', '!'], block: [] },
    'toml': { line: ['#'], block: [] },
};

function getScopeMode(document: vscode.TextDocument, position: vscode.Position): 'code' | 'comment' | 'unknown' {
    const langId = document.languageId;
    // 获取当前语言配置，如果没有特定的，尝试回退到默认（或者根据扩展名猜测，这里简化为默认）
    const config = LANGUAGE_CONFIGS[langId] || DEFAULT_CONFIG;

    const lineText = document.lineAt(position.line).text;
    const linePrefix = lineText.substring(0, position.character);

    // 1. 优先检查 Block Comments (向上回溯)
    // 为什么要先检查？因为对于 Python，""" 既是 String 也是 Comment。我们希望优先把它当 Comment。
    if (config.block.length > 0) {
        const maxBacktrack = 500; // 增加回溯深度以提高准确性
        
        for (const [startMarker, endMarker] of config.block) {
            // 情况 A: 对称标记 (如 Python """ ... """)
            if (startMarker === endMarker) {
                let count = 0;
                // 从当前行开始向上找，统计标记出现的总次数
                for (let i = position.line; i >= Math.max(0, position.line - maxBacktrack); i--) {
                    const text = i === position.line ? linePrefix : document.lineAt(i).text;
                    // 计算这一行有多少个标记
                    const matches = text.split(startMarker).length - 1;
                    count += matches;
                    
                    // 优化：如果在某一行发现了标记，且这行不是当前行，
                    // 我们可以通过奇偶性判断吗？
                    // 不行，必须累加所有看到的标记。
                    // 风险：如果回溯到了尽头还没找到配对的，怎么算？
                    // 假设：如果 count 是奇数，说明我们找到了一个“未闭合”的开始 -> Inside
                }
                
                if (count % 2 !== 0) {
                    return 'comment';
                }
            } 
            // 情况 B: 非对称标记 (如 /* ... */)
            else {
                for (let i = position.line; i >= Math.max(0, position.line - maxBacktrack); i--) {
                    const text = i === position.line ? linePrefix : document.lineAt(i).text;
                    
                    const lastStart = text.lastIndexOf(startMarker);
                    const lastEnd = text.lastIndexOf(endMarker);

                    if (lastStart === -1 && lastEnd === -1) continue;

                    if (lastStart > lastEnd) {
                        return 'comment';
                    } else {
                        // 找到了结束标记，且在开始标记之后（或者没找到开始标记）
                        // 此时确定在外面
                        break; 
                    }
                }
            }
        }
    }

    // 2. 行内注释判断
    for (const marker of config.line) {
        if (linePrefix.includes(marker)) {
            return 'comment';
        }
    }

    // 3. 字符串判定 (Code)
    // Python 的 """ 已经被上面的 step 1 捕获为 comment 了，所以这里剩下的引号就是普通单行字符串
    const cleanPrefix = linePrefix.replace(/\\"/g, '').replace(/\\'/g, '');
    const doubleQuotes = (cleanPrefix.match(/"/g) || []).length;
    const singleQuotes = (cleanPrefix.match(/'/g) || []).length;
    
    if (doubleQuotes % 2 !== 0 || singleQuotes % 2 !== 0) {
        return 'code'; 
    }

    return 'code';
}

export function deactivate() {
    if (sidecar) {
        sidecar.stop();
    }
}