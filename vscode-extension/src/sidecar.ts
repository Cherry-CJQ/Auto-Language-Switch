import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import * as readline from 'readline';

export class SidecarClient {
    private child: cp.ChildProcess | null = null;
    private outputChannel: vscode.OutputChannel;
    private rl: readline.Interface | null = null;
    private listeners: ((json: any) => void)[] = [];
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel("Auto Language Switch");
    }

    public onMessage(callback: (json: any) => void) {
        this.listeners.push(callback);
    }

    public start() {
        if (this.child) return;

        let exePath = '';
        if (this.context.extensionMode === vscode.ExtensionMode.Development) {
            // 开发模式：指向项目根目录下的 native-sidecar (假设 extension 在 root/vscode-extension)
            exePath = path.resolve(this.context.extensionPath, '../native-sidecar/target/debug/als-sidecar.exe');
        } else {
            // 生产模式：指向插件安装目录下的 bin 文件夹
            exePath = path.join(this.context.extensionPath, 'bin', 'als-sidecar.exe');
        }

        this.outputChannel.appendLine(`Starting sidecar from: ${exePath}`);
        this.outputChannel.appendLine(`Run Mode: ${this.context.extensionMode === vscode.ExtensionMode.Development ? 'Development' : 'Production'}`);

        try {
            this.child = cp.spawn(exePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

            if (this.child.stdout) {
                this.rl = readline.createInterface({ input: this.child.stdout, terminal: false });
                this.rl.on('line', (line) => {
                    try {
                        const json = JSON.parse(line);
                        this.listeners.forEach(cb => cb(json));
                    } catch (e) { }
                });
            }

            if (this.child.stderr) {
                this.child.stderr.on('data', (data) => {
                    this.outputChannel.appendLine(`[Sidecar Error] ${data.toString()}`);
                });
            }

            this.child.on('close', (code) => {
                this.outputChannel.appendLine(`Sidecar exited with code ${code}`);
                this.child = null;
            });
            
            this.child.on('error', (err) => {
                 this.outputChannel.appendLine(`Failed to start sidecar: ${err.message}`);
                 vscode.window.showErrorMessage(`ALS Sidecar Error: ${err.message}`);
            });

        } catch (error) {
            this.outputChannel.appendLine(`Error spawning: ${error}`);
        }
    }

    public stop() {
        if (this.child) {
            this.child.kill();
            this.child = null;
        }
    }

    public send(action: string, payload: string) {
        if (!this.child || !this.child.stdin) return;
        const msg = JSON.stringify({ action, payload }) + '\n';
        this.child.stdin.write(msg);
    }
}
