# dsh-codex 部署约定

`dsh-codex` 是最终运行目录。本项目仓库是开发源码目录，部署时构建并复制产物到 `dsh-codex`，不修改 `deepseek-harness`。

## 依赖

- Node.js >= 22
- 已安装且可执行的 `dsh`
- 已安装且可执行的 `codex`
- 使用自定义 provider 时，已启动合法安装的 Codex Mixin gateway

## 配置原则

配置文件只保存非敏感参数，例如 DSH 地址、Codex 命令路径、允许的工作目录、代理地址和超时。API key、OAuth token 和代理密码使用环境变量或系统凭据存储。

```bash
export DSH_CODEX_CODEX_BIN=codex
export DSH_CODEX_CODEX_ARGS='app-server --stdio'
export DSH_CODEX_ALLOWED_ROOT=$HOME
export DSH_CODEX_HTTP_PROXY='http://proxy.example.invalid:8080'
```

## 开发启动

```bash
pnpm install
pnpm typecheck
pnpm test
```

## 发布到 dsh-codex

```bash
mkdir -p dsh-codex/{bin,dist,config,data,logs}
pnpm build
cp -R dist/* dsh-codex/dist/
cp config/*.example.* dsh-codex/config/ 2>/dev/null || true
```

部署脚本必须执行依赖检查、版本检查和配置脱敏检查；失败时停止启动，不自动修改 DSH 或 Codex 的用户配置。
