# Auto-Language-Switch Technical Architecture (TDD)

**Version:** 1.0 (Architect Reviewed)  
**Date:** 2025-12-13  
**Status:** Approved for Development

## 1. 系统架构概览 (System Overview)

本项目采用 **Client-Sidecar** 架构。为了突破 Windows 进程隔离限制，Sidecar 采用了 **Thread Attachment** 模式。

```mermaid
graph TD
    A[VS Code Extension Host] -- JSON RPC (stdio) --> B[ALS Sidecar (Rust)]
    B -- GetForegroundWindow() --> C[Target Window Handle (HWND)]
    B -- GetWindowThreadProcessId() --> D[Target Thread ID]
    B -- AttachThreadInput() --> D
    B -- ImmSimulateHotKey / ActivateKeyboardLayout --> E[Windows OS IME Manager]
```

## 2. 核心技术难点与解决方案

### 2.1 跨进程输入法控制 (The "Thread Affinity" Problem)
Windows 输入法状态是与线程绑定的。外部进程无法直接修改目标窗口的 IME。
*   **Solution**: 使用 `AttachThreadInput` API。
    1.  Sidecar 获取当前前台窗口 (VS Code) 的句柄 (`GetForegroundWindow`).
    2.  获取该窗口的线程 ID (`GetWindowThreadProcessId`).
    3.  将 Sidecar 的自身线程与目标线程“关联” (`AttachThreadInput(target, self, true)`).
    4.  执行输入法切换。
    5.  **关键**: 执行完必须立即断开关联 (`AttachThreadInput(target, self, false)`), 防止阻塞 UI。

## 3. 通信协议 (Communication Protocol)

采用 **JSON Lines** 格式，UTF-8 编码。

### 3.1 握手与配置 (Handshake & Config)
在插件启动时，首先发送配置，告诉 Sidecar 什么是 "English" 什么是 "Chinese"。

**Request:**
```json
{ 
  "cmd": "config", 
  "en_id": "0x0409",  // 英语(美国) 的 Keyboard Layout ID
  "cn_id": "0x0804"   // 中文(简体) 的 Keyboard Layout ID
}
```
*注: 如果不传具体 ID，Sidecar 将尝试使用默认策略（如切换 Conversion Mode）。*

### 3.2 运行时指令 (Runtime Commands)
**Request:**
```json
{ "cmd": "switch", "target": "en" }
{ "cmd": "switch", "target": "cn" }
```

### 3.3 调试与状态 (Debug)
**Request:**
```json
{ "cmd": "ping" }
```
**Response:**
```json
{ "res": "pong", "ime_handle": 123456, "conversion_mode": 1 }
```

## 4. 模块划分 (Module Design)

### 4.1 VS Code Extension (TypeScript)
*   **`src/lifecycle.ts`**: 负责 Sidecar 的 `spawn`、`kill` 和自动重启 (Watchdog)。
*   **`src/protocol.ts`**: 封装 JSON 协议，提供 `send(command)` 方法。
*   **`src/controller.ts`**: 业务逻辑层。监听光标，防抖 (Debounce 100ms)，调用 protocol。

### 4.2 Native Sidecar (Rust)
*   **`src/main.rs`**: 
    *   主循环：读取 `stdin` -> `serde_json` 解析 -> 分发任务。
*   **`src/win32.rs`**: 
    *   **Unsafe 代码隔离区**。所有 `windows-rs` 库的调用都在这里。
    *   函数: `get_foreground_window_thread()`, `attach_thread()`, `set_ime_mode()`.

## 5. 错误处理策略 (Error Handling)
1.  **Sidecar 崩溃**: 插件端捕获 `close` 事件，等待 3秒后尝试重启。连续失败 5 次则停止服务并报错。
2.  **API 调用失败**: 如果 `AttachThreadInput` 失败（例如权限不足），Sidecar 返回 `{ "error": "Access Denied" }`，插件端在状态栏显示警告图标。

## 6. 构建与发布 (Build & CI)
*   **Dev 环境**: 插件直接调用 `target/debug/als-sidecar.exe`。
*   **Prod 环境**: CI 流程需交叉编译 Rust 代码，生成 `als-sidecar-win-x64.exe`，打包进 `.vsix` 的 `bin/` 目录中。
