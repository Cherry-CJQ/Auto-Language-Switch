# Auto-Language-Switch Technical Architecture

**Version:** 2.1 (Native Sidecar)  
**Date:** 2025-12-13

## 1. 架构概览

本项目采用 **Sidecar 模式**，通过独立的 Rust 进程来突破 VS Code (Electron) 沙箱对系统 API 的限制。

```mermaid
graph TD
    A[VS Code Extension] -- JSON (stdio) --> B[ALS Sidecar (Rust)]
    B -- Win32 API --> C[Windows OS Input Manager]
```

## 2. 模块职责

### 2.1 VS Code Extension (TypeScript)
*   **`extension.ts`**: 
    *   监听 `onDidChangeTextEditorSelection`。
    *   判断 Scope (Code vs Comment)。
    *   发送 `switch` 指令。
    *   实现 `Setup Wizard` UI 流程。
*   **`sidecar.ts`**:
    *   管理 `als-sidecar.exe` 子进程的生命周期 (spawn/kill)。
    *   处理 JSON 协议的序列化与反序列化。

### 2.2 Native Sidecar (Rust)
*   **API 能力**:
    *   `LoadKeyboardLayoutW`: 加载键盘布局。
    *   `PostMessageW(WM_INPUTLANGCHANGEREQUEST)`: 向目标窗口发送切换请求。
    *   `GetKeyboardLayoutList` & `ImmGetDescription`: 获取已安装输入法列表与名称。
*   **协议定义**:
    *   **Request**: `{ "action": "switch", "payload": "08040804" }`
    *   **Request**: `{ "action": "list" }`
    *   **Response**: `{ "status": "ok", "message": "...", "data": [...] }`

## 3. 关键流程

### 3.1 切换流程
1.  用户移动光标。
2.  TS 判断需要切换到中文。
3.  TS 读取配置 `chineseLayout` (e.g., `08040804`)。
4.  TS 发送 `{action: "switch", payload: "08040804"}`。
5.  Rust 解析 ID，调用 `PostMessage` 给 VS Code 窗口。
6.  Windows 响应消息，切换输入法。

### 3.2 配置流程 (Setup Wizard)
1.  用户运行 Setup Wizard。
2.  TS 发送 `list` 指令。
3.  Rust 调用 Win32 API 获取列表，返回 JSON 数组。
4.  TS 弹出 `QuickPick` 供用户选择。
5.  TS 将选中的 ID 写入 `settings.json`。
