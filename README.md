# dsh-sag

dsh-sag 是 DeepSeek Harness 的 SAG 本地个人知识库插件，让 dsh 可以检索和阅读知识、上传文件、写入笔记并管理文档。

## 兼容版本

- DeepSeek Harness：`0.1.1-rc.2`（当前 npm `latest`）
- SAG：需要包含“连接 dsh”设置和本地连接器 API

目前 dsh 还没有正式的 `0.1.1` 稳定版，dsh-sag `0.1.0` 已基于最新发布的 `0.1.1-rc.2` 完成打包和安装验证。

当前未修改的 SAG `1.8.3` 尚未包含本地连接器。正式版本发布前，请使用 [SAG PR #154](https://github.com/Zleap-AI/SAG/pull/154) 对应构建；PR 合并后，请使用首个包含该能力的 SAG 正式版本或更高版本。

## 快速开始

确认 dsh 和 SAG 已启动，再安装并检查插件：

```sh
dsh --version
dsh plugin --profile web add @zleap-ai/dsh-sag
dsh plugin --profile web exec dsh-sag doctor
```

`doctor` 显示“SAG 已连接”即可开始使用。插件会自动发现常见本机地址，正常使用不需要准备 Python 环境或手工填写密钥。

如果没有自动发现 SAG，运行 `setup`：

```sh
# 自动发现已经启动的 SAG
dsh plugin --profile web exec dsh-sag setup

# 使用 SAG 导出的连接文件
dsh plugin --profile web exec dsh-sag setup ./sag-dsh.json

# 显式指定 SAG 地址
dsh plugin --profile web exec dsh-sag setup --url http://127.0.0.1:8000

# 检查保存后的连接
dsh plugin --profile web exec dsh-sag doctor
```

## 使用方式

- 检查 SAG 状态
- 创建和查询知识源
- 检索知识并读取原文
- 上传本地文件或写入文本笔记
- 查询、重新处理和删除文档

SAG 会通过能力清单告诉插件当前可用的操作；插件不会调用 SAG 未启用的能力。

安装完成后，直接在 dsh 中提出知识库任务，例如：

- “在我的 SAG 知识库里查找 DW-2412P30 的上传限制，并给出原文依据。”
- “把 `/Users/me/Documents/产品手册.pdf` 上传到 SAG，处理完成后总结主要内容。”
- “把下面这段会议结论作为一篇笔记写入 SAG：……”

## 更新或卸载

```sh
dsh plugin --profile web update @zleap-ai/dsh-sag
dsh plugin --profile web remove @zleap-ai/dsh-sag
```

连接失败时，请确认 SAG 正在运行，然后重新执行 `setup` 和 `doctor`。普通用户不需要配置 Python 环境。
