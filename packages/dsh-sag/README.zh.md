# @zleap-ai/dsh-sag

dsh-sag 让 DeepSeek Harness 直接使用运行在本机的 SAG 个人知识库，包括检索、阅读、上传、写入和文档管理。

## 兼容版本

- dsh-sag：`0.1.1`（已发布的兼容修复版）；旧版 `0.1.0` 不适用于新版 dsh。
- DeepSeek Harness：本次核对版本为 `0.1.5-rc.1`（npm `latest`）和 `0.1.5-rc.2`（npm `next`），核对日期为 2026-09-13。包声明最低支持 `0.1.1-rc.2`；依赖范围不代表未来所有 `0.1.x` 版本都已验证。
- Node.js：`^22.19.0` 或 `>=24.0.0`；`dsh` 和 `pnpm` 需要在 PATH 中。
- SAG：需要包含“连接 dsh”设置和本地连接器 API。

## 开始使用

先安装 dsh 和 pnpm，并启动 SAG。已安装旧插件的用户请先阅读下方“旧版升级与启动恢复”。安装插件时无需先启动 Web：

```sh
dsh plugin --profile web add @zleap-ai/dsh-sag@0.1.1
dsh plugin --profile web exec dsh-sag doctor
dsh --profile web
```

`doctor` 显示“SAG 已连接”后，启动或重启 Web 才能使用新插件。命令由 `web` profile 执行，不需要把 `dsh-sag` 加入系统 PATH。插件会自动发现常见本机地址；不需要准备 Python 环境或手工填写密钥。

## 连接 SAG

如果 `doctor` 没有找到 SAG，任选一种方式保存连接：

```sh
# 自动发现已经启动的 SAG
dsh plugin --profile web exec dsh-sag setup

# 使用 SAG 导出的连接文件
dsh plugin --profile web exec dsh-sag setup ./sag-dsh.json

# 指定 SAG 的本机地址
dsh plugin --profile web exec dsh-sag setup --url http://127.0.0.1:8000
```

配置完成后再次检查：

```sh
dsh plugin --profile web exec dsh-sag doctor
```

## 直接告诉 dsh

- “在我的 SAG 知识库里查找 DW-2412P30 的上传限制，并给出原文依据。”
- “把 `/Users/me/Documents/产品手册.pdf` 上传到 SAG，处理完成后总结主要内容。”
- “把下面这段会议结论作为一篇笔记写入 SAG：……”

插件提供状态检查、知识源创建与查询、知识检索与原文读取、文件上传、文本写入，以及文档查询、重处理和删除能力。SAG 会通过能力清单告诉插件当前可用的操作；未启用的能力不会被调用。

## 旧版升级与启动恢复

如果安装过 `0.1.0`，请在升级 dsh 前先停止 Web 并升级插件。旧插件引用了新版 dsh 已删除的 `settingsNamespace` 导出，会导致 Web 在加载插件时失败；`0.1.1` 已移除该引用，并放宽宿主依赖范围。

即使 Web 已无法启动，以下管理命令仍可运行，它们不需要先启动 Web：

```sh
# 显式替换旧版本，包括之前固定为 0.1.0 的安装
dsh plugin --profile web add @zleap-ai/dsh-sag@0.1.1
dsh plugin --profile web list @zleap-ai/dsh-sag --depth 0
dsh plugin --profile web exec dsh-sag doctor
dsh --profile web
```

确认列表显示 `0.1.1` 后重新启动 Web。不要只运行不带目标版本的 `update`：它会遵循已保存的版本范围，精确固定为 `0.1.0` 的安装可能仍停留在旧版。`doctor` 检查 SAG 连接；Web 能否正常启动还需单独确认。

如果暂时无法升级插件，先卸载它以恢复 Web：

```sh
dsh plugin --profile web remove @zleap-ai/dsh-sag
dsh --profile web
```

插件管理命令会同步移除组合包注册，不需要删除整个 dsh 配置目录。卸载插件不会调用 SAG 的文档删除 API；恢复使用时重新安装并执行 `doctor`。

所有命令必须使用原安装的 profile 和相同的 `DSH_HOME`（如果设置过）；自定义 profile 请替换命令中的 `web`。如果曾在 `cordis.patch.yml` 中手工添加 dsh-sag 配置，卸载时也要移除对应条目，保留其他插件配置。新版本不会自动替换其他 profile 中仍安装的旧插件。

## 连接失败

确认 SAG 正在运行，然后执行 `dsh plugin --profile web exec dsh-sag setup` 和 `dsh plugin --profile web exec dsh-sag doctor`。如果自动发现失败，可以从 SAG 导出 `sag-dsh.json`，或使用上面的本机地址方式连接。

需要由 dsh 直接托管 Python 引擎时，请参阅[高级 embedded 模式](docs/embedded.md)。
