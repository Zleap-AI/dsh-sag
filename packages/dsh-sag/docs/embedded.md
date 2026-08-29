# dsh-sag embedded 模式

embedded 模式面向需要由 DeepSeek Harness 直接启动 `zleap-sag==0.10.0` 引擎的高级部署。普通本机 SAG 用户不需要此模式。

## 准备运行时

需要 Python 3.11+ 和 `uv`。先把插件安装到目标 profile：

```sh
dsh plugin --profile web add @zleap-ai/dsh-sag
```

`dsh plugin ... exec` 会在该 profile 的安装目录中运行命令，因此不依赖当前目录存在 `node_modules`：

```sh
dsh plugin --profile web exec node node_modules/@zleap-ai/dsh-sag/scripts/setup-runtime.mjs --python python3 --target "$HOME/.local/share/dsh-sag"
```

命令会创建固定版本的 Python 环境，并输出解释器路径。

## 配置

准备 SAG Engine 环境文件，例如 `/etc/dsh-sag/sag.env`。以下三个环境变量分别表示 Python 解释器、SAG 环境文件和允许使用的 namespace：

```sh
export DSH_SAG_PYTHON="$HOME/.local/share/dsh-sag/dsh-sag-runtime-0.1.0/bin/python"
export DSH_SAG_ENV_FILE=/etc/dsh-sag/sag.env
export DSH_SAG_NAMESPACES='[{"id":"product-docs","label":"产品文档"}]'
```

Harness home 优先使用 `$DSH_HOME`，未设置时是 `~/.dsh`。将下列 patch 写入 `$DSH_HOME/profiles/web/cordis.patch.yml`；如果未设置 `$DSH_HOME`，对应路径是 `~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
- id: dsh-sag
  name: '@zleap-ai/dsh-sag'
  config:
    mode: embedded
    pythonCommand: !!js process.env.DSH_SAG_PYTHON
    envFile: !!js process.env.DSH_SAG_ENV_FILE
    namespaces: !!js JSON.parse(process.env.DSH_SAG_NAMESPACES)
    defaultMode: fast
    maxResults: 20
    maxReadEngines: 4
    requestTimeoutMs: 30000
    shutdownGraceMs: 5000
```

每个 namespace 的 `id` 必须与 SAG 数据源一致，不能为空、不能重复，最长 36 个 URL-safe 字符。`label` 只用于向用户和模型说明其内容。

## 启动与诊断

插件加载时会检查 Python 可执行文件、环境文件、协议版本、`zleap-sag` 版本、引擎健康状态、证据读取能力和 namespace 列表。任一检查失败都会停止加载，并在 dsh 日志中给出具体原因。

先在不启动服务的情况下检查最终配置，再启动 `web` profile 并观察启动日志：

```sh
dsh --profile web --dump-config
dsh web
```

卸载插件或停止 dsh 时，插件先向 sidecar 发送 `shutdown` 并等待引擎释放资源；超过 `shutdownGraceMs` 后会终止受管进程树。运行中检索超时由 `requestTimeoutMs` 控制。
