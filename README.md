# Auto-Language-Switch (ALS)

**面向开发者的智能输入法自动切换工具。**

## 🚀 项目简介 (Overview)

ALS (Auto-Language-Switch) 旨在优化开发者的编程体验。它能根据光标在 IDE 中的上下文位置，自动切换系统的输入法状态。

*   **代码区域 (Code Scope)**: 自动切换为 **英文**，防止输入全角符号导致语法错误。
*   **注释区域 (Comment Scope)**: 自动切换为 **中文**（或您设定的其他语言），方便编写文档和注释。

本项目采用 **Sidecar (边车) 架构**：
*   **Frontend**: 轻量级的 VS Code 插件，负责检测语法树和光标位置。
*   **Backend**: 高性能的 **Rust** 本地进程，负责调用底层操作系统 API (Win32) 控制输入法。

## 📂 项目结构 (Project Structure)

| 目录 | 说明 |
| :--- | :--- |
| **`docs/`** | 技术文档，包含 [产品需求文档 (PRD)](docs/PRD.md) 和 [架构设计 (Architecture)](docs/ARCHITECTURE.md)。 |
| **`vscode-extension/`** | 客户端插件。使用 TypeScript 编写，处理 UI 交互和 TextMate 语法域检测。 |
| **`native-sidecar/`** | 服务端程序。使用 Rust 编写，处理底层的 Windows IMM32/TSF API 调用。 |

## 🛠️ 环境要求 (Prerequisites)

*   **操作系统**: Windows 10 或 Windows 11 (首发目标平台)。
*   **Node.js**: v16 或更高版本。
*   **Rust**: 最新稳定版工具链 (用于编译底层 Sidecar)。

## ⚡ 快速开始 (开发指南)

### 1. 编译 Rust Sidecar
```bash
cd native-sidecar
# 确保已安装 Rust 环境
cargo build
```

### 2. 运行 VS Code 插件
```bash
cd vscode-extension
npm install
npm run compile
```

### 3. 调试运行
1. 在 VS Code 中打开本项目根目录。
2. 按下 **F5** (确保运行配置选中的是 "Run Extension")。
3. 会弹出一个新的 "Extension Development Host" 窗口。
4. 尝试在代码和注释之间移动光标（功能需等待联调完成后生效）。

## 📝 开源协议
MIT