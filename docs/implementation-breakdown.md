# dsh-codex 目标、拆解与接口位置

版本：v1.0 · 2026-09-09

## 总目标

在不修改 `deepseek-harness` 的前提下，以 DSH 原有聊天界面为宿主，通过独立插件把 Codex 的会话、流式显示、resume、compact、stop、工具调用和审批能力接入浏览器；通过独立 auth 插件保护所有服务入口；通过用户已安装的 Codex Mixin/代理访问互联网和模型。

## 非目标

- 不重写 DSH UI。
- 不重写 Codex agent loop、工具执行器或 compact 算法。
- 不复制或打包 Codex Mixin 源码。
- 一期不做多用户账号、分布式部署、JWT、消息队列或微服务。

## 目标拆解

### G1：工程边界与可运行骨架

产物：`dsh-agent-plugin/plugins/*` 和 `dsh-codex/` 部署包。

验收：源码只存在本仓库，构建产物不包含 DSH/Mixin 源码和 secret。

### G2：独立鉴权插件

位置：`plugins/auth/`

接口位置：`plugins/auth/src/auth.ts`、`plugins/auth/src/security.ts`。

实现：单服务 token 登录、短期 HttpOnly session、Origin/CSRF、HTTP middleware、WebSocket upgrade、logout、过期和限流。

验收：无鉴权请求全部拒绝；长期 token 不进 URL、前端存储、日志或进程参数。

### G3：Codex 协议传输

位置：`plugins/codex-agent/src/protocol.ts`

接口：`CodexTransport`（JSON-RPC request/notification/close）。

实现：app-server stdio framing、请求关联、通知分发、错误、取消、超时、子进程清理。

验收：mock app-server 可以测试正常响应、通知、错误和退出。

### G4：Codex 事件归一化

位置：`plugins/codex-agent/src/events.ts`

接口：`EventNormalizer` / `AgentEvent`。

实现：将版本相关 Codex notification 转换成稳定的 DSH 事件；支持 text、reasoning、tool、approval、file change、usage、turn completed、error；提供 event id、sequence 和关联 id。

验收：未知事件可诊断；重复事件可去重；事件顺序可恢复。

### G5：Codex 会话生命周期

位置：`plugins/codex-agent/src/session.ts`

接口：`SessionLifecycle`。

实现：thread start、turn start、resume、compact、interrupt、close；显式状态机；单 session 单 active turn；失败和取消清理。

验收：所有非法状态转换有明确错误；stop 不留下子进程；resume/compact 不由 DSH 自行改写历史。

### G6：持久化与重连

位置：后续新增 `plugins/codex-agent/src/repository.ts`、`plugins/codex-agent/src/reconnect.ts`。

接口：`SessionRepository`、`EventCursorStore`。

实现：仅保存 DSH 索引、事件游标和必要展示元数据；Codex 历史仍由 Codex 管理；重连按 sequence 补发。

验收：刷新浏览器不丢事件、不重复事件；服务重启后可识别未知运行状态。

### G7：DSH 公开扩展适配

位置：后续新增 `plugins/dsh-adapter/src/`。

接口：`DshTransportAdapter`、`DshChatProjection`。

实现：通过 DSH 已公开 profile/RPC/插件入口注册 session、消息和事件；UI 只消费 DSH 事件，不直接读取 Codex 协议。

验收：`deepseek-harness` 工作树零修改；DSH 原有聊天界面保留。

### G8：Mixin、代理和模型状态

位置：后续新增 `plugins/provider-adapter/src/`。

接口：`ProviderStatus`、`ModelCatalog`、`ProxySettings`。

实现：读取用户配置、检查 loopback gateway、展示 provider/model 状态；出站请求走用户配置代理；不向浏览器暴露 key。

验收：官方 Codex 路径和 Mixin 自定义 provider 都可诊断；代理错误可定位且已脱敏。

### G9：部署、诊断和安全门禁

位置：`deployment/`、`dsh-codex/bin/`。

接口：命令行 `doctor` 和 `start`。

实现：依赖检查、Codex 版本/schema 检查、auth 配置检查、cwd 检查、日志脱敏检查、优雅退出。

验收：缺少 auth token、Origin、Codex 或权限配置时启动失败，不自动修改宿主配置。

## 依赖方向

```text
DSH adapter → Agent public API → SessionLifecycle → CodexTransport
DSH adapter → AuthService
Provider adapter → config/status interfaces
Auth plugin 不依赖 agent plugin
Protocol 不依赖 UI、存储、auth 或 provider
Repository 不启动进程
```

禁止反向依赖和循环依赖。

## 开发顺序

严格按 G1 → G2 → G3 → G4 → G5 → G6 → G7 → G8 → G9 推进。每个目标必须先完成接口、测试和验收，再进入下一个目标；不得为了提前接 UI 跳过协议和鉴权测试。
