# dsh-codex 设计原则

版本：v1.0 · 2026-09-09

本文件是强制开发原则。任何实现、重构、插件拆分和代码评审都必须遵守；当功能需求与本文件冲突时，必须先修改并确认设计原则，再开发代码。

## 1. 单一职责（Single Responsibility）

一个模块、类、函数或插件只拥有一个变化原因。

- auth 只处理认证和授权入口。
- Codex adapter 只处理 Codex 协议和会话生命周期。
- event normalizer 只转换事件，不保存状态。
- repository 只负责持久化，不启动进程。
- UI adapter 只负责展示投影，不执行工具。
- proxy/provider adapter 只负责上游连接配置和状态，不管理聊天会话。

如果一个模块同时处理协议、业务、存储和展示，必须拆分。

## 2. 开放封闭（Open/Closed）

对新增 provider、事件类型、鉴权后端和部署方式开放，对已经稳定的核心流程保持封闭。

- 通过接口、注册表和插件增加能力。
- 不通过修改核心 agent loop 支持每一种新工具。
- 未知协议事件可以记录和展示为诊断事件，不能破坏已有事件处理。
- 扩展不得复制已有实现并改名。

## 3. 里氏替换（Liskov Substitution）

实现同一接口的 provider、transport、repository 或 auth service 必须满足相同的输入、输出、错误、取消和生命周期约定。

- mock Codex transport 必须遵守真实 transport 的异步和事件顺序语义。
- provider 不得偷偷改变鉴权、超时或错误语义。
- 替换实现不能要求调用方增加特殊分支。

## 4. 接口隔离（Interface Segregation）

调用方只依赖完成职责所需的最小接口。

禁止让 UI 依赖包含启动进程、写数据库和读取 secret 的大接口。优先拆成：

```text
CodexTransport
SessionLifecycle
EventStream
ApprovalService
SessionRepository
AuthService
ProviderStatus
```

新增方法必须证明属于现有接口的同一职责；否则创建新接口。

## 5. 依赖倒置（Dependency Inversion）

高层业务依赖稳定接口，不依赖具体进程、HTTP 库、数据库或 DSH 实现细节。

```text
SessionManager → CodexTransport
SessionManager → SessionRepository
HTTP adapter   → AuthService
```

具体实现通过构造函数或插件注册注入。禁止在业务函数内部直接读取环境变量、创建全局单例或启动不可替换的子进程。

## 6. 组合优于继承（Composition over Inheritance）

优先组合小型 service、policy 和 adapter，不建立深层继承树。

- 用 `SessionManager` 组合 transport、event sink、repository 和 approval service。
- 用 policy 函数组合 cwd、Origin、速率和权限校验。
- 只有当替换行为和生命周期完全一致时才使用继承。

## 7. 封装与最小知识原则

每一层只知道相邻层的公开接口，不读取其他层的内部状态。

- UI 不知道 Codex JSON-RPC 方法名。
- Codex protocol 不知道 DSH transcript 组件。
- agent 不知道 token 的内容和存储位置。
- auth 不知道工具参数、prompt 或模型请求。
- repository 不返回可变的内部集合。

敏感数据和协议细节必须在拥有它们的模块内封装。

## 8. 端口与适配器（Ports and Adapters）

外部依赖都通过端口接入，具体实现放在适配器中：

```text
核心业务端口：CodexTransport / AuthService / EventStore
适配器：app-server stdio / cookie auth / SQLite or JSONL / DSH RPC
```

更换 Codex 传输方式、存储方式或代理方式不应改动核心会话状态机。

## 9. 策略模式（Policy/Strategy）

会变化的规则必须显式建模为策略，不在流程中散落条件判断。

适用范围：

- approval policy
- sandbox policy
- cwd policy
- Origin policy
- retry/backoff policy
- provider routing
- event retention

策略必须有默认值、配置来源、失败行为和测试；安全策略不得由用户输入直接覆盖。

## 10. 工厂与生命周期管理

进程、WebSocket、session、repository 和 provider 都必须由明确的 factory/manager 创建和销毁。

每个拥有资源的对象必须明确：

- 创建者
- 所有者
- 关闭方法
- 关闭是否幂等
- 超时和取消行为
- 异常后的清理方式

禁止在模块加载时启动服务、创建子进程或注册无法撤销的全局监听器。

## 11. 状态模式与显式状态机

会话、鉴权 session、工具调用和审批必须使用显式状态转换，不用多个布尔值隐式表达状态。

例如会话状态：

```text
idle → running → waiting_approval → running → completed
idle → running → failed
running → stopping → idle
```

每次转换必须定义允许的前置状态、结果状态和重复请求行为。非法转换返回可诊断错误，不静默修正。

## 12. 事件驱动与观察者隔离

流式事件使用发布/订阅或 sink 接口传递；生产者不依赖具体 UI。

- 事件必须有唯一 id、顺序号、关联 id 和时间。
- 订阅者异常不能反向杀死事件生产者。
- 事件处理必须幂等，可重放、去重和断点续传。
- 事件 payload 不包含长期 token、OAuth token、代理密码或未脱敏 secret。

## 13. 命令与查询分离（CQRS 的适度使用）

改变状态的操作和读取状态的查询分开：

- 命令：start、send、stop、compact、approve、logout。
- 查询：session list、session detail、provider status、event history。

一期不引入完整 CQRS 基础设施，不使用消息队列；只在接口和服务职责上保持分离。

## 14. 防御式设计

外部边界必须明确校验、超时、取消、重试和错误映射：

- JSON-RPC
- 子进程 stdout/stderr
- 网络代理和上游响应
- WebSocket 输入
- 文件路径和 cwd
- 用户 prompt 和工具参数
- 持久化数据

内部 typed 调用不重复做无意义校验，但不能把外部数据当作可信数据。

## 15. 安全优先与最小权限

- 默认 loopback、最小 sandbox、最小工具权限。
- 鉴权插件独立于 Codex 插件，HTTP 和 WebSocket 使用同一鉴权服务。
- 长期 token 只在服务端内存或外部凭据系统中存在。
- 浏览器使用短期 HttpOnly session cookie，不使用 URL 或 localStorage token。
- secret 不进入代码、测试、文档、日志、事件和进程参数。
- 任何放宽权限的配置必须显式、可审计、可回退。

## 16. 适度设计原则

设计模式不是目标，解决问题才是目标。

- 一个真实实现不抽象出通用框架。
- 两个实现共享稳定行为时才抽象接口。
- 三个以上重复场景再考虑公共基础设施。
- 不为未来可能发生的需求预留复杂层次。
- 不用模式名称替代清晰职责。
- 能用函数解决的问题不创建类；能用一个插件解决的问题不拆成多个插件。

## 17. 评审强制问题

每个非简单变更必须回答：

1. 这个模块的唯一变化原因是什么？
2. 哪个接口隔离了外部依赖？
3. 是否可以替换为 mock 而不修改业务代码？
4. 是否引入了不必要的继承、全局状态或框架？
5. 状态转换、失败、取消和清理是否明确？
6. 是否存在跨层依赖或职责泄漏？
7. 是否可能泄露敏感信息或扩大权限？
8. 是否有测试证明新增抽象由真实场景需要？

不能回答清楚时，不得继续扩大实现范围。
