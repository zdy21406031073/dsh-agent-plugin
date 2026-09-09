# DSH Agent Plugin

DSH 中的 Codex 集成插件。

本项目独立开发，不修改 `deepseek-harness`；最终运行目录为 `dsh-codex`。当前实现从职责最小的 Codex app-server stdio 协议层开始：不解析 ANSI，不复制 Codex Mixin 源码，不在 UI 层实现 agent loop。

## 开发

```bash
pnpm install
pnpm typecheck
pnpm test
```

代码规范见 `CODE_STANDARDS.md`；设计原则见 `DESIGN_PRINCIPLES.md`；目标拆解和接口位置见 `docs/implementation-breakdown.md`；开发清单见 `DEVELOPMENT.md`；完整产品需求见 `docs/codex-integration-requirements.md`。
