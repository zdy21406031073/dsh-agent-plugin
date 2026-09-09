# dsh-codex 单服务鉴权设计

版本：v0.3 · 2026-09-09

## 目标

在单用户、单服务场景下提供足够安全且容易部署的保护，不引入账户系统、数据库、JWT、OAuth 或复杂密钥轮换。

## 推荐模型

```text
浏览器
  ↓ HTTPS（生产）
反向代理（可选，负责 TLS）
  ↓ 本机连接
dsh-codex
  ├─ 登录：一次性提交访问 token
  ├─ 服务端内存 session：随机 session id
  ├─ HttpOnly + Secure + SameSite=Strict cookie
  └─ API / WebSocket 均验证 cookie
```

服务默认只监听 `127.0.0.1`。需要远程访问时，使用 Nginx/Caddy/Tailscale 等受控入口，不直接把 Node 服务暴露到公网。

## 认证凭据

唯一长期凭据是由部署者注入的 `DSH_CODEX_AUTH_TOKEN`：

```bash
export DSH_CODEX_AUTH_TOKEN="$(openssl rand -hex 32)"
```

要求：

- 至少 32 字节随机值；建议 64 个 hex 字符。
- 只从环境变量、systemd credential、Docker/Kubernetes Secret 或系统凭据管理器读取。
- 服务启动时只保留 token 的内存副本；不写配置文件、数据库、日志或错误信息。
- 不接受默认值，不接受空值，不接受短 token。
- 不把 token 放进 URL、HTML、JavaScript、localStorage、sessionStorage 或 Git。

## 登录流程

### `POST /auth/login`

请求体：

```json
{"token":"<用户输入>"}
```

服务端：

1. 限制 body 最大长度，例如 4 KiB。
2. 使用 constant-time comparison 比较 token。
3. 成功后生成至少 32 字节的随机 session id，只保存其哈希值。
4. 返回不包含凭据的成功响应，并设置：

```http
Set-Cookie: dsh_codex_session=<opaque-id>; Path=/; HttpOnly; Secure; SameSite=Strict
```

5. 失败统一返回 `401 Unauthorized`，不区分 token 缺失、错误或服务配置状态。

登录接口只允许 `Content-Type: application/json`，并校验请求 Origin；禁止 GET 登录，避免 token 出现在访问日志和浏览器历史中。

### 后续请求

- 浏览器自动发送 HttpOnly cookie。
- 服务端验证 session id 的哈希、过期时间和撤销状态。
- 每个 session 绑定创建时的服务实例和客户端属性摘要；不记录完整 User-Agent/IP。
- session 默认 12 小时过期，闲置 30 分钟过期；过期后需要重新登录。
- 服务重启清空内存 session，要求重新登录。

### `POST /auth/logout`

撤销当前 session 并清除 cookie。退出只影响当前浏览器 session，不修改长期 token。

## WebSocket

WebSocket 必须使用同源 URL，浏览器自动携带 HttpOnly cookie。upgrade 阶段执行：

1. Origin 精确匹配允许列表。
2. Cookie session 验证。
3. session 对应的用户/服务权限验证。

拒绝无效连接，不使用 `?token=`。不得把长期 token 放入 WebSocket URL，因为 URL 会进入代理、浏览器和服务器日志。

## CSRF 与跨域

- `SameSite=Strict` 是默认防线。
- 所有状态变更请求校验 `Origin`；缺失 Origin 的浏览器状态变更请求拒绝。
- 只允许显式配置的 Origin，禁止 `*`。
- 不启用通配 CORS，不允许凭据跨任意域发送。
- 如果部署在反向代理之后，应用只信任代理明确传入的协议和 Host，不盲信任任意 `X-Forwarded-*`。

## 失败和限流

- 登录失败使用统一响应和恒定的低信息错误消息。
- 按来源和服务实例做登录失败限流；超过阈值暂时延迟或拒绝。
- API 和 WebSocket 建立也做基础速率限制。
- 断开连接、过期 session、无效 session 不输出 token、cookie 或完整请求体。
- 审计日志只记录时间、结果、路由和匿名 request id。

## 服务配置

最小生产配置：

```bash
export DSH_CODEX_AUTH_TOKEN="$(openssl rand -hex 32)"
export DSH_CODEX_ALLOWED_ORIGINS='https://dsh.example.com'
export DSH_CODEX_BIND='127.0.0.1'
export DSH_CODEX_PORT='8787'
```

本地开发可以使用 HTTP，但仍然必须鉴权。生产环境由反向代理终止 TLS，应用只接收本机连接。

## 不采用的方案

- 不使用 JWT：单服务不需要无状态分布式验证，JWT 增加泄露、撤销和轮换复杂度。
- 不使用 localStorage token：容易被 XSS 读取。
- 不使用 URL token：会泄露到历史、日志、Referer 和代理。
- 不把长期 token 作为每个 WebSocket 消息发送：cookie session 更适合浏览器。
- 不引入密码数据库和用户注册：当前目标是单服务单用户。

## 必须测试

- 无 cookie、过期 cookie、伪造 cookie、错误 Origin 全部拒绝。
- 登录 token 不出现在 access log、error log、响应体和 URL。
- 登录成功设置正确 cookie 属性。
- logout 后旧 cookie 立即失效。
- 服务重启后旧 session 失效。
- WebSocket upgrade 与 HTTP 使用相同鉴权结果。
- 任意跨域请求、通配 Origin、GET 登录和超大登录 body 被拒绝。
