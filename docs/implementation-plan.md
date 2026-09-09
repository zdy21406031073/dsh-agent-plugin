# DSH Codex 完整实现方案

版本：v0.2 · 2026-09-09

## 目标与约束

`dsh-agent-plugin` 是唯一开发仓库；`deepseek-harness` 不修改。最终运行目录是 `dsh-codex`。DSH 原有聊天界面继续作为 UI 宿主，插件提供 Codex 适配服务和 UI 数据，不复制 DSH 界面或 Codex Mixin 源码。

## 分层

```text
浏览器 / DSH 原有聊天界面
  ↓ DSH 已有 RPC/WebSocket 扩展点
dsh-codex adapter
  ├─ Auth middleware（Bearer token、Origin、会话权限）
  ├─ Session API（创建、列表、resume、compact、stop）
  ├─ Stream adapter（断线重连、游标、去重）
  └─ CodexSessionManager
       ├─ CodexProtocolClient（app-server JSON-RPC stdio）
       ├─ EventNormalizer（协议事件 → DSH transcript event）
       └─ ApprovalController（工具审批响应）
Codex app-server
  └─ Codex 配置 → Mixin loopback gateway（可选）→ HTTP(S) proxy → 上游
```

每层只有一个职责：协议层不存储数据，存储层不启动进程，UI 不处理 Codex 原始协议，鉴权层不参与 agent 状态机。

## 请求流程

1. 浏览器携带 `Authorization: Bearer <token>`，服务端校验 token 和 `Origin`。
2. 创建 session 时校验 cwd 位于允许根目录，生成 DSH session id。
3. Session manager 启动受管控的 Codex app-server client，并调用 thread/start。
4. 用户消息只发送给对应 thread；服务端拒绝跨 session 操作。
5. Codex 通知由 normalizer 转为带 sequence 的统一事件，经 WebSocket 推送并持久化游标。
6. 工具审批进入 approval controller；只有原 session 的已鉴权客户端可以响应。
7. 浏览器断线时 Codex turn 继续；重连后按 after_sequence 补发缺失事件。

## 鉴权方案（一期单用户）

配置：

```bash
export DSH_CODEX_AUTH_TOKEN='<从环境变量或凭据管理器注入的至少 32 字符随机值>'
export DSH_CODEX_ALLOWED_ORIGIN='http://127.0.0.1:3000'
export DSH_CODEX_ALLOWED_ROOT="$HOME"
```

- token 只从环境变量或系统凭据读取，不写入仓库、URL、前端 localStorage 或日志。
- HTTP 和 WebSocket 都必须鉴权；WebSocket 在 upgrade 阶段拒绝无 token 连接。
- 支持 Authorization: Bearer；MVP 不实现 cookie。
- localhost 也鉴权，避免本机恶意网页利用服务。
- 使用 constant-time comparison；错误只返回 401，不区分 token 是否存在。
- 校验 Origin，生产部署必须 HTTPS；不允许任意 CORS。
- 二期增加多用户账号、session owner、角色和审计查询。

## Codex 功能映射

| DSH 操作 | Codex 适配职责 |
|---|---|
| 新建会话 | `thread/start` |
| 发送消息 | `turn/start` |
| 继续 | 复用 thread id，调用协议支持的 resume/turn 方法 |
| 停止 | `turn/interrupt`，随后确认状态 |
| 压缩 | Codex 原生 compact 方法，不在 DSH 重写摘要 |
| 工具调用 | 接收 Codex tool events，映射成 DSH tool rows |
| 审批 | 显示请求详情，回传 approval response |
| 文件变更 | 展示 diff/result，不由 UI 直接写文件 |
| Web search/fetch | 由 Codex 工具和 Mixin/代理配置执行，DSH 只展示来源和状态 |

具体方法名、参数和通知名以部署时 Codex 生成的 schema 为准；启动时执行版本/能力探测，不静默调用未知方法。

## 交付阶段

1. 协议层：schema 锁定、JSON-RPC client、mock server、错误和取消。
2. 会话层：session manager、索引、事件游标、重连。
3. DSH adapter：通过公开 profile/RPC 扩展点注册，不改 DSH 源码。
4. 聊天展示：文本、reasoning 折叠、工具时间线、审批、diff、usage。
5. Mixin/代理：provider 状态、模型目录、代理诊断、官方路径兼容。
6. 部署：生成 `dsh-codex`，启动/诊断脚本，版本矩阵，安全和 E2E 测试。

## 验收标准

- 无 token 的 HTTP、WebSocket 请求全部拒绝。
- 创建会话、流式回复、工具调用、审批、stop、resume、compact 均可在 DSH 原界面完成。
- 浏览器刷新后按序号补齐事件，不重复显示。
- `deepseek-harness` 工作树无任何修改；插件包不包含其源码或 Mixin 源码。
- API key、OAuth token、代理密码不出现在浏览器、URL、日志和 Git 历史。
