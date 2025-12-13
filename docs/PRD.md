# Product Requirement Document (PRD) - Auto-Language-Switch

**Version:** 0.2 (Refined)  
**Status:** Approved  
**Date:** 2025-12-13  
**Author:** Gemini (Sr. RE)

## 1. 项目愿景 (Project Vision)
打造一款**无感**、**高性能**且**隐私安全**的 IDE 输入法自动切换插件。它能理解程序员的上下文（代码 vs 注释），自动管理输入法状态，让开发者专注于逻辑构建而非按键切换。

## 2. 核心用户体验流程 (User Journey)

### 2.1 典型工作流
1.  **Coding**: 开发者在编写 Java/Python 代码，输入法被锁定在 **[EN]** 状态。
2.  **Commenting**: 开发者输入 `//` 或 `/*`，插件检测到 Scope 变化，毫秒级切换输入法至 **[CN]** 状态，开发者直接输入中文。
3.  **Back to Code**: 换行或移动光标出注释区，输入法瞬间切回 **[EN]**。
4.  **Exceptions**: 在字符串 (`"User Name"`) 中，用户可通过快捷键临时切换，插件在当前会话记住该偏好。

## 3. 功能需求 (Functional Requirements)

### 3.1 上下文感知 (Context Awareness) [IDE侧]
*   **FR-01 语法域检测**: 
    *   插件需基于 IDE 的语法树（AST）或 TextMate Scopes 精确判断光标位置。
    *   **关键 Scopes**: `comment` (注释), `string` (字符串), `source` (源代码), `constant` (常量).
*   **FR-02 事件驱动**: 
    *   监听 `onDidChangeTextEditorSelection` (光标移动) 和 `onDidChangeActiveTextEditor` (切换文件)。
    *   **防抖 (Debounce)**: 避免在快速连续移动光标时频繁触发系统 API（建议阈值 100ms）。
*   **FR-03 排除规则**:
    *   支持 `.gitignore` 风格的排除配置（例如不处理 `.txt` 或 `.md` 文件，或者反之，只在 `.java`, `.ts` 中生效）。

### 3.2 输入法控制 (IME Control) [Native侧]
*   **FR-04 状态获取**: 能够获取当前窗口的 IME 句柄 (HWND) 和转换状态 (Conversion Status)。
*   **FR-05 状态切换**:
    *   **策略 A (首选)**: **切换转换模式 (Conversion Mode)**。保持当前输入法（如微软拼音）不变，仅通过 API 切换其“中/英”模式。体验最平滑。
    *   **策略 B (备选)**: **切换键盘布局 (Keyboard Layout)**。在“英语(美国)”和“中文(简体)”之间切换。
*   **FR-06 跨进程支持**: 兼容 Windows TSF (Text Services Framework) 和旧版 IMM32 架构。

### 3.3 用户配置与交互
*   **FR-07 初始校准 (Setup Wizard)**:
    *   插件初次安装后，引导用户分别切换到“英文状态”和“中文状态”，插件记录这两个状态的特征值（ID 或 Layout Handle）。
*   **FR-08 状态栏指示器**: 在 IDE 底部状态栏显示当前插件判定的状态（例如 `[ALS: EN]`），点击可暂停插件。

## 4. 技术架构 (Technical Architecture)

### 4.1 Sidecar 模式 (Client-Server/CLI)
由于 Web 技术栈无法深层控制 OS，采用 **IDE Plugin + Native Sidecar** 结构。

*   **Plugin (TypeScript/Kotlin)**:
    *   负责业务逻辑、配置管理、UI 交互。
    *   通过 `child_process` 或 `stdio` 管道调用 Sidecar。
*   **Sidecar (Rust/C++ - Windows API)**:
    *   **无状态 CLI 工具**，体积需极小 (< 2MB)。
    *   **命令接口**:
        *   `als-cli get-status`: 返回当前 IME ID 和 Open/Close 状态。
        *   `als-cli set-english`: 强制切换到预设的英文模式。
        *   `als-cli set-chinese`: 强制切换到预设的中文模式。

### 4.2 数据流
`User Action` -> `VS Code Event` -> `Scope Logic (Is Comment?)` -> `Spawn/IPC` -> `Sidecar (Win32 API)` -> `OS IME`

## 5. 非功能需求 (Non-functional Requirements)

*   **NFR-01 性能**: 从光标停止移动到输入法切换完成，总延迟应 **< 50ms**，确保用户无感知。
*   **NFR-02 资源占用**: Sidecar 不应常驻后台占用高 CPU，或者应作为一个极其轻量的守护进程。
*   **NFR-03 隐私 (Privacy)**: 
    *   **严禁**记录用户的任何按键内容（Keystrokes）。
    *   只读取光标位置的元数据（Scope Name）。
*   **NFR-04 鲁棒性**: 如果 Sidecar 崩溃或被杀毒软件拦截，插件应优雅降级（只报错一次，然后自动禁用功能），不影响 IDE 正常使用。

## 6. 风险与对策
*   **Risk**: Windows 11 更新频繁，IME API 可能变动。
    *   *Plan*: 使用 Rust 的 `windows-rs` 库，它封装较好，且社区更新及时。
*   **Risk**: WSL2 / Remote SSH 场景。
    *   *Plan*: 这是一个复杂场景。如果在 WSL 中运行 VS Code Server，Sidecar 无法控制宿主机的输入法。
    *   *Decision*: V1.0 版本 **暂不支持** Remote 模式（或者明确说明只支持 Local Window），V2.0 考虑通过 Socket 通信解决 Remote 问题。

## 7. 实施路线图 (Phase 1 Detailed)
1.  **Native Research**: 编写一个最小化的 C++ 或 Rust 程序，验证能否在 Windows 10/11 上通过命令行切换 微软拼音的中英状态。
2.  **Plugin Skeleton**: 建立 VS Code 插件，实现 Scope 检测并打印日志。
3.  **Integration**: 联调 Plugin 与 Native 程序。