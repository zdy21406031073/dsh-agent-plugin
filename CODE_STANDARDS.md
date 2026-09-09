# dsh-codex 代码规范与开发约束

版本：v1.0 · 2026-09-09

本文件是本项目所有实现、评审和发布的强制规范。它提取并固化已确认的代码要求；未满足规范的代码不得合并。

## 1. 项目边界

1. 所有新增代码只在 `dsh-agent-plugin` 中开发。
2. `deepseek-harness` 是外部宿主和公开扩展点参考，禁止修改其源码、复制其源码或把修改提交到其仓库。
3. 最终部署目录固定为 `dsh-codex`。
4. Codex Mixin 仅通过用户合法安装的运行时、网关或公开接口使用；不复制、打包或修改受限源码。
5. 通过 DSH 已公开的插件、profile、API 或 RPC 扩展点集成；禁止依赖修改宿主源码才能工作的隐式耦合。

## 2. 设计原则

### 2.1 高可维护性

- 每个模块有单一、可描述的职责。
- 模块之间通过最小的 typed interface 通信。
- 协议、业务状态、持久化、传输、UI 投影和安全策略分层。
- 优先使用已有稳定能力；不重复实现 Codex agent loop、工具执行器、Markdown 渲染或 DSH 会话存储。
- 公开导出必须有清晰的输入、输出、失败和生命周期说明。
- 复杂逻辑必须配套单元或集成测试；行为变更同步更新文档。

### 2.2 正确抽象

- 先确认真实扩展点和协议，再设计适配器。
- 抽象必须由至少两个真实调用场景证明；单一调用不得预先引入通用框架。
- Codex 版本差异封装在协议适配层，不向 UI 泄露版本字段。
- DSH transcript 事件使用稳定的内部事件类型，原始 Codex JSON 只停留在协议层或诊断详情中。
- 不使用大而全的 `Service`、`Manager` 或万能工具类；名称必须体现拥有的资源和操作。

### 2.3 不过度设计

- 一期只实现单服务、单用户、单实例部署。
- 不提前引入 JWT、OAuth、账户系统、分布式 session、消息队列或微服务。
- 不实现终端 ANSI 解析；使用 Codex app-server JSON-RPC。
- 不在 DSH 侧重写 Codex 的 compact、resume、工具执行和审批语义。
- 可选能力以独立插件或适配器实现，不污染核心路径。

## 3. 插件职责

### 3.1 `dsh-codex-auth`

只负责：登录、token 校验、session cookie、Origin/CSRF、HTTP 和 WebSocket 鉴权、logout、过期和限流。

不得负责：Codex、模型、工具、文件、聊天 UI、Mixin provider。

### 3.2 `dsh-codex-agent`

只负责：Codex app-server、thread/turn 生命周期、resume、compact、stop、事件归一化、工具/审批/文件事件。

不得复制鉴权逻辑；只能依赖 auth 插件公开服务。

### 3.3 DSH UI adapter

只负责把统一事件投影到 DSH 原有聊天界面；不得直接启动 Codex、读取 token 或调用上游模型。

## 4. 安全规范

1. 所有长期凭据由环境变量或外部凭据系统注入；代码、测试、文档、示例和 Git 历史不得包含真实 secret。
2. token 不得出现在 URL、前端存储、日志、错误消息、事件 payload 或进程参数中。
3. 服务默认监听 loopback；公网访问必须通过 HTTPS 反向代理或受控网络入口。
4. HTTP、WebSocket 和 session 操作使用同一鉴权服务；不能只保护前端或 HTTP。
5. 登录 token 至少 32 字节随机值；使用 constant-time comparison。
6. 浏览器使用 HttpOnly、Secure、SameSite=Strict 的短期 session cookie；不使用 URL token 或 localStorage token。
7. Origin 使用显式白名单，禁止通配符；状态变更请求执行 CSRF 防护。
8. cwd 必须限制在配置的允许根目录；所有子进程可取消、有超时、可清理。
9. 错误和日志必须脱敏；审计只记录 request id、时间、路由、结果和匿名标识。

## 5. 代码质量

- TypeScript 使用 strict 模式和 ESM。
- 禁止无理由的 `any`、隐式全局状态和跨层循环依赖。
- 外部进程、网络、JSON、文件和 WebSocket 都视为不可信边界，必须显式处理异常、取消和超时。
- 公共 ID 使用 branded/opaque 类型或明确的命名类型，禁止混用普通字符串。
- 状态机使用显式 discriminant；未知协议事件必须可诊断但不能导致服务崩溃。
- 所有事件带 session/thread/turn 关联、序号和唯一 id；消费端去重且保持顺序。
- 文件结尾一个换行；提交前执行格式、类型检查和测试。

## 6. 开发流程

1. 先更新需求、接口和验收标准，再写代码。
2. 先用 mock Codex app-server 验证协议，再接真实 Codex。
3. 每个阶段只修改本仓库；禁止修改 `deepseek-harness`。
4. 每个功能提交包含：实现、测试、必要文档和安全影响说明。
5. 未确认的 Codex 协议方法名不得写死到 UI；从当前版本 schema 或能力探测确认。
6. 推送前检查 `git diff --check`、类型检查和相关测试。

## 7. 合并验收

- 职责边界可以通过目录和依赖图检查。
- 鉴权插件可独立测试和启动失败保护。
- Codex 插件在没有 auth 插件时拒绝暴露服务。
- DSH 原代码工作树无修改。
- 无敏感信息扫描命中。
- `dsh-codex` 可以从构建产物部署，不携带 DSH/Mixin 源码和用户凭据。
