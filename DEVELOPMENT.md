# 开发前确认清单

在开始每个实现阶段前必须确认：

- [ ] 变更只发生在 `dsh-agent-plugin`。
- [ ] 目标部署路径为 `dsh-codex`。
- [ ] 是否新增职责；若是，是否应拆为独立插件。
- [ ] 是否有真实的第二个调用场景支持新抽象。
- [ ] 是否复用了 DSH/Codex 已有能力而非重新实现。
- [ ] HTTP 和 WebSocket 是否同时受 `dsh-codex-auth` 保护。
- [ ] 是否可能把 secret 写入代码、测试、URL、日志、环境快照或 Git。
- [ ] 是否有取消、超时、断线、重连和子进程清理路径。
- [ ] 是否增加了对应测试和文档。

## 默认实现顺序

1. 公开接口和版本兼容说明
2. auth 插件完整生命周期
3. Codex app-server mock transport
4. Codex session/事件适配
5. DSH RPC/UI adapter
6. Mixin/代理状态适配
7. dsh-codex 打包和诊断
