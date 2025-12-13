import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import * as readline from 'readline';

export class SidecarClient {
    private child: cp.ChildProcess | null = null;
    private outputChannel: vscode.OutputChannel;
    private rl: readline.Interface | null = null;
    // 简单的回调列表
    private listeners: ((json: any) => void)[] = [];

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel("Auto Language Switch");
    }

    public onMessage(callback: (json: any) => void) {
        this.listeners.push(callback);
    }

    public start() {
        if (this.child) return;

        // 注意：生产环境需要改为 path.join(context.extensionPath, 'bin', ...)
        const exePath = path.resolve(__dirname, '../../native-sidecar/target/debug/als-sidecar.exe');
        this.outputChannel.appendLine(`Starting sidecar from: ${exePath}`);

        try {
            this.child = cp.spawn(exePath, [], { stdio: ['pipe', 'pipe', 'pipe'] });

            if (this.child.stdout) {
                this.rl = readline.createInterface({ input: this.child.stdout, terminal: false });
                this.rl.on('line', (line) => {
                    // this.outputChannel.appendLine(`[Sidecar] ${line}`);
                    try {
                        const json = JSON.parse(line);
                        // 触发回调
                        this.listeners.forEach(cb => cb(json));
                    } catch (e) {
                        // ignore non-json
                    }
                });
            }
            
            // ... stderr handling ...

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