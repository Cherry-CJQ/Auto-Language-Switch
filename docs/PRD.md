# Product Requirement Document (PRD) - Auto-Language-Switch

**Version:** 0.4 (Final Native)  
**Status:** Implemented  
**Date:** 2025-12-13  

## 1. 项目愿景 (Project Vision)
打造一款能真正控制 Windows 输入法状态的 VS Code 插件，实现“代码区英文、注释区中文”的自动化流转，并提供极简的配置体验。

## 2. 核心功能 (Functional Requirements)

### 2.1 输入法控制 (IME Control)
*   **FR-01 切换**: 插件必须能够强制将当前窗口的输入法切换到指定的键盘布局 (HKL)。
    *   *实现*: Rust Sidecar (`LoadKeyboardLayout` + `PostMessage`).
*   **FR-02 识别**: 插件必须能列出系统当前已安装的所有输入法及其名称（如 "Sogou Pinyin"）。
    *   *实现*: Rust Sidecar (`GetKeyboardLayoutList` + `ImmGetDescription`).

### 2.2 上下文感知 (Context Awareness)
*   **FR-03 代码模式**: 光标进入非注释、非字符串区域时，切换至 `englishLayout`。
*   **FR-04 注释模式**: 光标进入注释 (`//`, `#`) 或字符串区域时，切换至 `chineseLayout`。
*   **FR-05 防抖**: 避免光标微小移动导致重复发送指令。

### 2.3 用户体验 (UX)
*   **FR-06 配置向导**: 提供交互式命令 `ALS: Setup Wizard`，引导用户从列表中选择输入法，而非手动输入 Hex ID。

## 3. 技术架构 (Technical Architecture)

采用 **Client-Sidecar** 架构：
*   **Client**: VS Code Extension (Node.js/TS) - 负责逻辑判断与 UI。
*   **Server**: Native Binary (Rust) - 负责调用 Win32 API。
*   **Protocol**: JSON Lines over Stdio.

## 4. 交付物 (Deliverables)
*   VS Code 插件包 (.vsix)
*   内嵌编译好的 `als-sidecar.exe`