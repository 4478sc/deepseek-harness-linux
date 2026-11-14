# DeepSeek Harness · Linux 桌面版

给官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 桌面端做社区 Linux 打包的下游 fork：为 Linux 增加 AppImage、Debian `.deb` 与便携 `.tar.gz`（x64 / arm64），保留上游的 agent 与插件体系，并跟随上游版本。

[English](README.md) | 中文

## 这是什么

- 面向 Linux 的**打包与分发**层，不是重写 harness：agent 主循环、插件、协议与 Web UI 均来自上游。
- 基于上游 `dsh-v0.2.2-rc.3`（`38a6a5c965aa99ab525161efb7cc5cf1fe62fced`）加本 fork 的 Linux 工作。
- 每个架构三种产物：AppImage（支持自动更新）、Debian 包、便携 tarball。

## 这不是什么

- 不是 DeepSeek 官方产品；harness 本身的问题请反馈上游。
- 没有自建遥测端点、不要求云账号、不提供托管服务。

## 安装

从 [Releases](https://github.com/4478sc/DSH_Linux/releases) 下载对应架构的产物（在本地仓库发布 release 之前，产物由源仓库发布）。

AppImage：

```sh
sudo apt install libfuse2          # Debian / Ubuntu; libfuse2t64 on 24.04 and later
# Fedora / RHEL: sudo dnf install fuse2
chmod +x deepseek-harness-*-linux-x64.AppImage
./deepseek-harness-*-linux-x64.AppImage
```

Debian 包：

```sh
sudo dpkg -i deepseek-harness-*-linux-amd64.deb
deepseek-harness
```

便携 tarball：

```sh
tar -xzf deepseek-harness-*-linux-x64.tar.gz
cd deepseek-harness-*-linux-x64
./deepseek-harness
```

无显示环境（例如远程服务器 + VNC）请先设置 `DISPLAY`（如 xfce4 + TigerVNC 下的 `:1`）。

## 从源码构建

需要 Node.js >= 24.9、pnpm 11.28.5（由 `packageManager` 固定）；构建 AppImage 的主机还需 `libfuse2`。

```sh
pnpm install --frozen-lockfile
pnpm run package:linux:x64     # 或 package:linux:arm64
```

产物位于 `apps/desktop/.desktop-build/targets/linux-<arch>/artifacts`；带 `:dir` 的变体只产出解包目录。Linux 包不做代码签名，只读取 `.env.linux`（示例见 `apps/desktop/.env.linux.example`）。

## 上游来源与 fork 改动

上游来源：[4478sc/deepseek-harness-linux](https://github.com/4478sc/deepseek-harness-linux)，分支 `upgrade/0.2.2-rc.3` 及其 Linux 打包历史。本仓库从该仓库的提交 `1281e8d2e812c55d97c577f574e38df4628d33a0`（PR #2 head，基线为 `master` 的 `2ba014261c86c`）导入。

fork 独有内容：

- Electron Builder 的 AppImage / `.deb` / `.tar.gz` 目标，以及 Linux CI 与烟测。
- Linux 图片解码隔离：原生解码放在一次性独立 Node 进程中，而不是 Electron，规避 Linux 上 libvips 崩溃。
- Linux 更新通道与自托管发布（默认关闭）。

## 兼容性

- Linux x64 与 arm64；两者都有 CI 构建与烟测，arm64 未在真实 ARM 硬件上运行。
- Node 24 与 pnpm 11.28.5，与上游工具链下限一致。
- 上游桌面功能完整；Office 文档转换依赖上游 office runtime 包。

## 验证状态

已跑与未跑，按实际情况记录：

- 类型检查（`tsc -b`）、lint 与重复代码、67 个 static gate、录制快照、产物门禁、consumer 聚合与 benchmark 均在 GitHub-hosted `ubuntu-24.04` 上通过（fork 自带验证 workflow）。
- 覆盖率**未绿**：4 核 hosted runner 上仍有测试超时（90 s 预算下 13 次，预算与上游一致），跑不完；fork 新增分支的覆盖已补齐（附件存储文件本地 100%），剩余是 runner 资源问题。
- Python `--scenario all --installed-wheel` 在本 fork 与上游 tag 的同一环境下**都失败**，记为上游层面问题，而非本 fork 回归。
- Windows 检查、Issue policy 检查、真实 ARM 硬件仍未测。

## 安全

二进制未签名，请校验发布的校验和；应用数据留在本机，只联系你配置的模型端点。

## 许可证

MIT，继承自上游；本仓库的 `LICENSE` 为创建仓库时的文件，未作修改。
