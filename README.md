# DeepSeek Harness · Linux Desktop

Community Linux packaging for the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) desktop application. This repository is a downstream fork: it adds AppImage, Debian `.deb` and portable `.tar.gz` packaging for Linux on x64 and arm64, keeps upstream's agents and plugins intact, and tracks upstream releases.

English | [中文](README.zh.md)

## What this is

- A **packaging and distribution** layer for Linux, not a rewrite of the harness. The agent loop, plugins, protocols and Web UI come from upstream unchanged.
- Built from upstream `dsh-v0.2.2-rc.3` (`38a6a5c965aa99ab525161efb7cc5cf1fe62fced`) plus this fork's Linux work.
- Ships three formats per architecture: AppImage (auto-update), Debian package, portable tarball.

## What this is not

- Not an official DeepSeek product. Issues about the harness itself belong upstream.
- No telemetry endpoint of its own, no cloud account, no hosted service.

## Install

Download the artifact for your architecture from [Releases](https://github.com/4478sc/DSH_Linux/releases) (published by the source repository until a release is cut here).

AppImage:

```sh
sudo apt install libfuse2          # Debian / Ubuntu; libfuse2t64 on 24.04 and later
# Fedora / RHEL: sudo dnf install fuse2
chmod +x deepseek-harness-*-linux-x64.AppImage
./deepseek-harness-*-linux-x64.AppImage
```

Debian package:

```sh
sudo dpkg -i deepseek-harness-*-linux-amd64.deb
deepseek-harness
```

Portable tarball:

```sh
tar -xzf deepseek-harness-*-linux-x64.tar.gz
cd deepseek-harness-*-linux-x64
./deepseek-harness
```

In a headless environment set `DISPLAY` (for example `:1` under xfce4 + TigerVNC) before starting the desktop client.

## Build from source

Requirements: Node.js >= 24.9, pnpm 11.28.5 (pinned by `packageManager`), and `libfuse2` on the build host for the AppImage target.

```sh
pnpm install --frozen-lockfile
pnpm run package:linux:x64     # or package:linux:arm64
```

The packages land in `apps/desktop/.desktop-build/targets/linux-<arch>/artifacts`. Variants with `:dir` only produce the unpacked directory. Linux builds are unsigned and read `.env.linux` only (`apps/desktop/.env.linux.example`).

## Upstream provenance and this fork's changes

Source of truth: [4478sc/deepseek-harness-linux](https://github.com/4478sc/deepseek-harness-linux), branch `upgrade/0.2.2-rc.3`, plus the Linux packaging history behind it. This repository was imported from that repository at commit `1281e8d2e812c55d97c577f574e38df4628d33a0` (PR #2 head, base `2ba014261c86c` on `master`).

Fork-specific additions:

- Electron Builder targets for AppImage, `.deb` and `.tar.gz`, plus Linux CI lanes and smoke tests.
- An isolated image worker for Linux: native image decoding runs in a one-shot standalone Node process instead of Electron, which avoids the libvips crash on Linux.
- Auto-update channel wiring for the Linux feed, with self-hosted publishing kept opt-in.

## Compatibility

- Linux x64 and arm64. CI builds and smoke-tests both; arm64 has not been run on physical ARM hardware.
- Node 24 and pnpm 11.28.5, matching upstream's toolchain floor.
- Upstream's desktop features are all present; Office document conversion depends on the upstream office runtime bundle.

## Verification status

What has been run, and what has not:

- Type-check (`tsc -b`), lint and duplication, the 67 static gates, the recorded snapshot gate, the artifact gate, the consumer aggregate and the benchmark lane pass on GitHub-hosted `ubuntu-24.04` through the fork's verification workflows.
- Coverage is **not green**: on a four-core hosted runner the suite still hits test timeouts (13 at the 90 s budget, the same budget upstream grants) and cannot finish; the fork-specific branch coverage was fixed (the attachment store file is at 100% locally), the remaining gap is runner capacity.
- The Python `--scenario all --installed-wheel` lane fails on both this fork and the upstream tag in the same environment, so it is recorded as an upstream-level failure rather than a fork regression.
- Windows checks, Issue-policy checks and real ARM hardware remain untested.

## Security

Binaries are unsigned; verify the published checksums. The application keeps data on the local machine and contacts only the model endpoints you configure.

## Licence

MIT, inherited from upstream. The `LICENSE` file in this repository is the one this repository was created with and is unchanged.
