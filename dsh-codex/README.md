# dsh-codex

`dsh-codex` 是部署目录，不是 DSH 源码目录。它加载本项目构建产物，并调用用户已安装的 DSH、Codex 和可选 Codex Mixin。

## 安全启动

```bash
export DSH_CODEX_AUTH_TOKEN="$(openssl rand -hex 32)"
export DSH_CODEX_ALLOWED_ORIGINS='http://127.0.0.1:3000'
export DSH_CODEX_ALLOWED_ROOT="$HOME"
./bin/doctor.mjs
```

禁止把真实 token、API key、OAuth token 或代理密码写入此目录、Git、URL、浏览器存储或日志。
