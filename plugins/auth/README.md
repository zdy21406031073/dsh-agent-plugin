# dsh-codex-auth

独立的单服务鉴权插件。它只负责登录、session cookie、Origin 校验、HTTP middleware 和 WebSocket upgrade 鉴权，不负责 Codex、会话、模型或工具。

长期 token 通过 `DSH_CODEX_AUTH_TOKEN` 注入；浏览器登录成功后使用 HttpOnly、Secure、SameSite=Strict cookie，不在 URL 或前端存储长期 token。
