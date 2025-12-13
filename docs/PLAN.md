# Development Plan - Auto Language Switch (ALS)

本文档追踪项目的开发进度，基于 [PRD](PRD.md) 和 [Architecture](ARCHITECTURE.md) 制定。

**当前状态**: 🟢 Phase 3 (Complete)

---

## ✅ Phase 1: 基础设施搭建
- [x] Project Setup (Docs, Git).
- [x] Rust Sidecar Init.
- [x] VS Code Extension Init.

## ✅ Phase 2: 核心技术攻关
- [x] **Native Switching**:
    - [x] 尝试 PostMessage 方案.
    - [x] 尝试 AttachThreadInput 方案.
    - [x] 最终方案: `LoadKeyboardLayout` + `PostMessage` (成功).
- [x] **ID Support**:
    - [x] 支持直接传递 HKL (Hex ID).
    - [x] 支持 `list` 命令获取系统输入法列表.

## ✅ Phase 3: 用户体验与配置
- [x] **Setup Wizard**:
    - [x] 实现 `auto-language-switch.setup` 命令.
    - [x] 交互式选择输入法.
    - [x] 自动保存到 User Settings.
- [x] **Scope Detection**:
    - [x] Code vs Comment/String 识别.
    - [x] 状态防抖.

## ⚪ Future (Release)
- [ ] 自动化 CI/CD 构建发布.
- [ ] 发布到 Visual Studio Marketplace.
