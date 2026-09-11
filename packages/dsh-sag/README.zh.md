# @zleap-ai/dsh-sag

dsh-sag 让 DeepSeek Harness 直接使用运行在本机的 SAG 个人知识库，包括检索、阅读、上传、写入和文档管理。

适用于 DeepSeek Harness `0.1.x`，最低版本为 `0.1.1-rc.2`。SAG 需要包含“连接 dsh”设置和本地连接器 API；当前未修改的 SAG `1.8.3` 尚未包含该能力，请使用 [SAG PR #154](https://github.com/Zleap-AI/SAG/pull/154) 对应构建，或后续包含该能力的正式版本。

## 开始使用

请先安装并启动 SAG，再安装插件：

```sh
dsh plugin --profile web add @zleap-ai/dsh-sag
dsh plugin --profile web exec dsh-sag doctor
```

`doctor` 显示“SAG 已连接”即可开始使用。命令由 `web` profile 执行，不需要把 `dsh-sag` 加入系统 PATH。插件会自动发现常见本机地址；不需要准备 Python 环境或手工填写密钥。

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

## 更新或卸载

```sh
dsh plugin --profile web update @zleap-ai/dsh-sag
dsh plugin --profile web remove @zleap-ai/dsh-sag
```

## 连接失败

确认 SAG 正在运行，然后执行 `dsh plugin --profile web exec dsh-sag setup` 和 `dsh plugin --profile web exec dsh-sag doctor`。如果自动发现失败，可以从 SAG 导出 `sag-dsh.json`，或使用上面的本机地址方式连接。

需要由 dsh 直接托管 Python 引擎时，请参阅[高级 embedded 模式](docs/embedded.md)。
