# ✨ Auto-Language-Switch (ALS) ✨


**💡 让中文开发者在写代码时，彻底忘掉切换输入法这件事。**

## 📝 项目简介

Auto-Language-Switch (ALS) 是一款专为开发者设计的 VS Code 扩展，旨在通过智能切换输入法，提升中英文混合编程环境下的开发效率。它能够自动识别光标所在位置是代码区域还是注释区域，并相应地切换至英文或中文输入法，让您无需手动干预，专注于编码。

**核心功能特性:**

*   **智能自动切换**:
    *   **Coding**: 自动切换到 **英文输入法**。
    *   **Commenting**: 自动切换到 **中文输入法**。
*   **一键配置向导**:
    *   内置 `ALS: Setup Wizard` 命令，自动扫描系统输入法，可视化选择，免去手动查找 ID 的繁琐。
*   **高性能 Sidecar**:
    *   采用 Rust 编写的本地进程，直接调用 Windows 底层 API，响应迅速且稳定，确保流畅的切换体验。

## 🖥️ 兼容性与支持

*   **操作系统**:
    *   目前原生 Sidecar 仅支持 **Windows** 操作系统，后续可能会考虑支持 macOS 和 Linux。
*   **开发环境**:
    *   **Visual Studio Code** (版本 1.80.0 及以上)。
*   **支持的编程语言**:
    *   插件的智能切换功能支持多种编程语言的注释检测，包括但不限于 C/C++, Java, JavaScript, TypeScript, Python, Go, Rust, HTML, CSS, Vue, Shell Script 等。



## 🚀 插件使用说明

### 通过 VSIX 文件安装

从GitHub Releases下载 `.vsix` 插件文件，您可以按照以下步骤在 VS Code 中进行安装：

1.  打开 VS Code。
2.  点击左侧活动栏的 **扩展 (Extensions)** 图标 (或按下 `Ctrl+Shift+X`)。
3.  在扩展视图右上角的“更多操作”菜单 (三个点 `...`) 中选择 **“从 VSIX 安装...” (Install from VSIX...)**。
4.  在弹出的文件浏览器中，选择您下载的 `.vsix` 文件，然后点击 **“安装” (Install)**。
5.  安装完成后，VS Code 可能会提示您重启以激活插件。

### 首次使用 (强烈推荐)

插件安装后，请务必运行配置向导来绑定您的输入法，以确保功能正常：

1.  按 `Ctrl+Shift+P` 打开 VS Code 命令面板。
2.  输入并选择 **`ALS: Setup Wizard`** 命令。
3.  按照提示，依次选择您的 **英文输入法** 和 **中文输入法**。
4.  配置将自动保存，即刻生效。

### 手动配置

如果您偏好手动配置，可以在 `settings.json` 中直接设置输入法的 HKL (Hex ID)：

```json
{
    "autoLanguageSwitch.englishLayout": "04090409", // 例如：English (US)
    "autoLanguageSwitch.chineseLayout": "08040804"  // 例如：Chinese (Simplified)
}
```

## 🛠️ 二次开发指南

本项目采用前后端分离的架构，包含 VS Code 扩展前端和 Rust 编写的本地 Sidecar 后端。

### 项目结构 (Structure)

| 目录 | 说明 |
| :--- | :--- |
| **`vscode-extension/`** | 插件前端 (TypeScript)。负责上下文检测、语言配置管理以及与 Sidecar 的通信。 |
| **`native-sidecar/`** | 核心后端 (Rust)。作为本地进程运行，负责系统级输入法枚举与切换，直接调用 Windows 底层 API。 |

### 开发步骤

1.  **克隆仓库**:
    ```bash
    git clone git@github.com:Cherry-CJQ/Auto-Language-Switch.git
    cd Auto-Language-Switch
    ```
2.  **编译 Rust Sidecar**:
    进入 `native-sidecar` 目录并使用 Cargo 编译。
    ```bash
    cd native-sidecar
    cargo build --release # 编译发布版本以获得最佳性能
    cd ..
    ```
3.  **编译 VS Code 插件**:
    进入 `vscode-extension` 目录，安装依赖并编译 TypeScript 代码。
    ```bash
    cd vscode-extension
    npm install
    npm run compile
    cd ..
    ```
4.  **调试**:
    在 VS Code 中，打开本项目文件夹，然后按 `F5` 启动调试窗口。这将启动一个带有 ALS 扩展的新的 VS Code 实例，您可以在其中测试和调试插件功能。

## 📝 许可证
[MIT](./LICENSE.md)
