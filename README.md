# DSH Agent Plugin

DSH 中的 Codex 集成方案与实现入口。

本仓库当前包含可执行的详细开发需求。实现时以 `deepseek-ai/deepseek-harness` 的现有界面和运行模型为宿主，不复制 `codex-mixin` 受限源码；通过已安装的 Codex CLI/app-server 和 Mixin 本地网关完成集成。

## 目标

- 保留 DSH 原有聊天界面、主题、布局、会话列表和快捷键。
- 在 DSH 内呈现 Codex 原生事件语义：回复、推理摘要、工具调用、审批、文件变更、命令输出和错误。
- 支持新建、继续（resume）、中止、压缩（compact）、模型/工作目录/权限模式切换。
- 通过 Codex Mixin 的本地网关使用 DeepSeek、OneAPI、OpenAI-compatible 等上游，并保留官方 Codex 路径。

详细需求见 [`docs/codex-integration-requirements.md`](docs/codex-integration-requirements.md)。
