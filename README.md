# DSH Agent Plugin

DSH 中的 Codex 集成插件。当前实现从职责最小的 Codex app-server stdio 协议层开始：不解析 ANSI，不复制 Codex Mixin 源码，不在 UI 层实现 agent loop。

## 开发

```bash
pnpm install
pnpm typecheck
pnpm test
```

完整产品需求见 `docs/codex-integration-requirements.md`。
