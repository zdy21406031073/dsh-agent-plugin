# DSH × Codex × Codex Mixin 详细开发需求

> 版本：v0.1 · 日期：2026-09-09 · 状态：待确认后实施

## 1. 背景与范围

将 Codex（会话编排、上下文、工具、审批、resume/compact）和 Codex Mixin（provider、模型目录、本地网关、代理/协议适配）集成进 DSH。DSH 只负责 Web/UI、会话持久化索引和请求转发，不重新实现 Agent loop、工具执行器或模型协议转换。

### 必须遵守的边界

1. 以 DSH 原有 UI 为基础，禁止另起一套终端式界面。
2. Codex 作为独立进程，通过 `codex app-server` 的 JSON-RPC/stdio（或受控 WebSocket）通信；禁止解析终端 ANSI 输出作为业务协议。
3. Mixin 作为外部本地服务/已安装 CLI 使用，不复制其受限源码；需确认其许可允许的运行与接口调用方式。
4. 所有互联网访问（模型请求、Web search、远程内容）继承用户配置的代理；服务端不得把 API key、代理认证信息发到浏览器。
5. MVP 不实现自定义工具沙箱；优先复用 Codex 原生工具和审批策略。

## 2. 用户故事

- 用户在 DSH 中创建 Codex 任务，选择模型、工作目录和权限模式。
- 用户看到流式回答，并能展开 reasoning、工具调用、命令输出、文件变更和审批卡片。
- 用户刷新浏览器或重新连接后，能恢复正在运行/已完成的会话。
- 用户可从历史会话 resume，继续对话而不丢失 Codex thread。
- 用户发现上下文过长时可点击“压缩”，继续使用同一 thread。
- Codex 请求通过 Mixin 网关访问 DeepSeek 等 provider；用户可在 DSH 设置里查看 provider/模型状态。
- 用户可批准/拒绝命令、文件写入、网络访问，或立即停止任务。

## 3. 功能需求

### 3.1 会话

- 新建会话：`cwd`、模型、推理强度、审批策略、沙箱策略、初始提示。
- 列表：标题、thread id、cwd、模型、状态（idle/running/waiting_approval/completed/failed）、更新时间。
- 继续：按 Codex thread id 调用 resume/continue；前端不自行拼接历史消息。
- 删除/归档：只删除 DSH 索引，不默认删除 Codex 本地 thread 数据。
- 停止：取消当前 turn，释放子进程/请求；状态可恢复且无僵尸进程。
- 重连：服务重启后从 Codex/本地状态恢复可见会话，事件序号可续传或明确显示“历史已加载”。

### 3.2 消息与事件显示

统一内部事件 `AgentEvent`，至少支持：`turn_started`、`text_delta`、`reasoning_delta/summary`、`tool_started`、`tool_progress`、`tool_completed`、`command_output`、`file_change`、`approval_required`、`usage`、`turn_completed`、`error`。

- 文本增量实时渲染 Markdown，代码高亮，禁止未转义 HTML。
- reasoning 默认折叠；工具调用默认展示名称、参数摘要、状态和耗时，原始 JSON 可展开。
- shell 输出支持增量、退出码、复制；文件变更显示路径、diff 摘要和查看入口。
- approval 卡片显示风险、具体动作、命令/路径/URL，提供一次性批准、拒绝、按策略批准（若 Codex 协议支持）。
- 事件顺序按 `thread_id + turn_id + sequence` 去重；重复事件不能造成重复气泡。

### 3.3 Codex 能力

- 新任务、继续任务、取消 turn。
- compact：调用 Codex 原生 compact/instructions，不在 DSH 侧摘要替代；显示压缩前后状态和失败原因。
- 模型切换：仅在新 turn 或协议允许时切换；展示 Mixin 模型目录中的可用模型和能力标签。
- 工具：复用 Codex 的 shell、文件读写/patch、搜索、Web search/互联网内容等能力；每次工具执行都经过 Codex 的 sandbox/approval。
- 配置：model、reasoning effort、sandbox、approval policy、network access、cwd；敏感配置仅服务端保存。
- 可选扩展：图片/附件、MCP、并行工具、usage/cost 面板，列入第二阶段。

### 3.4 Mixin/代理

- DSH 提供 provider 状态页：网关地址、运行状态、模型目录更新时间、最近错误；密钥只显示掩码。
- 支持官方 Codex 和 Mixin 自定义 provider 两种模式，明确显示当前路由。
- 代理配置读取顺序：DSH 显式配置 > 环境变量 > Codex/Mixin 配置；支持 HTTP/HTTPS/SOCKS（具体能力以依赖为准）。
- 后端出站请求统一经过代理配置；WebSocket 到本机 app-server 不走公网代理。
- 代理不可用时显示可诊断错误（连接、TLS、认证、上游状态码、超时），不得泄露 token。
- 禁止浏览器直连上游模型 API，避免 CORS、密钥泄露和绕过审批。

## 4. 推荐架构（职责单一）

```text
DSH UI
  └─ DSH Agent API / WebSocket（鉴权、会话、重连、事件转发）
       ├─ CodexSessionManager（thread 生命周期与并发）
       ├─ CodexProtocolClient（JSON-RPC framing、请求/响应、通知）
       ├─ EventNormalizer（Codex 事件 → AgentEvent）
       ├─ ApprovalController（审批关联与超时）
       ├─ SessionRepository（仅 DSH 索引与事件游标）
       └─ ProviderStatusAdapter（Mixin 网关健康/模型目录）
             └─ codex app-server / Codex CLI
                    └─ Codex Mixin loopback gateway → proxy → upstream
```

每个模块只保留一个方向的依赖：UI 不接触 Codex 协议；ProtocolClient 不写数据库；Repository 不启动进程；Mixin adapter 不参与聊天事件。

## 5. 接口契约

### 5.1 前端 HTTP

- `POST /api/agent/sessions`：创建会话，返回 `session_id/thread_id`。
- `GET /api/agent/sessions`：分页列表。
- `GET /api/agent/sessions/:id`：元数据与已持久化摘要。
- `POST /api/agent/sessions/:id/resume`：恢复。
- `POST /api/agent/sessions/:id/compact`：请求压缩。
- `POST /api/agent/sessions/:id/stop`：停止当前 turn。
- `POST /api/agent/approvals/:approval_id`：`approve/reject`。
- `GET /api/providers/status`、`GET /api/providers/models`：Mixin 状态和模型。

### 5.2 前端 WebSocket

`/api/agent/sessions/:id/stream`：服务端推送 `AgentEvent`；客户端发送：

```json
{"type":"user_message","text":"...","client_message_id":"..."}
{"type":"approval_response","approval_id":"...","decision":"approve"}
{"type":"stop"}
```

事件必须带 `event_id`、`session_id`、`thread_id`、`turn_id`、`sequence`、`timestamp`、`type`、`payload`。协议版本放在握手响应中。

## 6. 数据模型

- `agent_sessions(id, thread_id, title, cwd, model, provider, status, created_at, updated_at)`。
- `agent_turns(id, session_id, turn_id, status, started_at, completed_at, usage_json)`。
- `agent_events(event_id, session_id, turn_id, sequence, type, payload_json, created_at)`：只保留可配置窗口，原始大输出可落盘。
- `agent_approvals(id, session_id, turn_id, request_json, status, expires_at)`。

Codex 的完整历史仍以 Codex 为准；DSH 数据库用于索引、重连和 UI 查询，避免双写完整状态。

## 7. 错误、并发和安全

- 同一 session 同时只允许一个 active turn；不同 session 可并发，但设置全局/用户并发上限。
- app-server 断线：指数退避重连；无法确认结果时标记 `unknown`，禁止自动重复提交用户消息。
- 所有子进程必须有 owner、超时、取消和退出清理；服务退出时优雅停止。
- cwd 必须规范化并按允许根目录校验；禁止通过请求访问任意系统目录。
- 浏览器鉴权、CSRF/Origin 校验、WebSocket 权限校验、速率限制、审计日志。
- 日志默认脱敏：API key、Authorization、Cookie、代理密码、完整 prompt/工具参数可配置禁止记录。

## 8. 分阶段交付

### P0：协议 Spike

确认本机 Codex 版本的 app-server 方法/通知、resume、compact、审批和工具事件；写协议录制回放测试。验收：不依赖真实模型即可回放完整 turn。

### P1：MVP 聊天

保留 DSH UI，接入新建/流式文本/停止/错误/会话列表；单用户、单实例、stdio app-server。验收：长回答不丢事件，刷新可重连。

### P2：完整 Codex 交互

resume、compact、工具时间线、审批卡片、文件 diff、sandbox/权限配置、事件持久化。验收：shell/文件工具能审批并正确显示结果；拒绝不会误执行。

### P3：Mixin 与代理

provider 设置、模型目录、网关健康、代理配置和诊断。验收：通过 Mixin 访问至少一个兼容 provider；代理失败可定位；官方模式不受影响。

### P4：生产化

多用户权限、并发配额、断线恢复、指标、审计、部署文档、升级兼容矩阵和安全测试。

## 9. 测试与验收

- 单元：JSON-RPC framing、事件归一化、去重排序、状态机、路径/配置脱敏。
- 集成：mock app-server 覆盖正常、工具、审批、compact、resume、取消、断线。
- E2E：浏览器创建会话、流式显示、刷新恢复、审批、继续和压缩。
- 安全：XSS、CSRF、越权 session、命令注入、路径穿越、token 日志泄露、代理 SSRF。
- 性能：首字节延迟、事件吞吐、100 个并发空闲会话、长输出内存上限。

## 10. 待确认问题

1. DSH 的部署形态和技术栈/目标目录是什么（当前远端仓库未能稳定拉取完整源码）？
2. 目标是单用户本机使用，还是需要多用户登录、权限和团队隔离？
3. 允许 DSH 要求安装 `codex` 和 `codex-mixin`，还是必须内置二进制？
4. Mixin 源码当前许可证明确限制复制、运行、编译和衍生使用；请确认是否有版权方书面许可。没有许可时只能调用用户合法安装的 Mixin，不能把其源码/二进制打包进插件。
5. 代理类型和地址是 HTTP(S) 还是 SOCKS？是否需要代理认证？
6. 是否需要 MCP、自定义工具、图片附件和多用户配额列入一期？
