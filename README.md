# DeepSeek Harness · Linux Desktop

> Community Linux desktop packaging for the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) desktop app: an open-source (MIT) DeepSeek desktop client that installs and updates on Linux, shipped as AppImage, Debian `.deb` and portable `.tar.gz` for x64 and arm64, with native CI and AppImage auto-updates.

**In one line**: a DeepSeek desktop client for Linux that you can download, install and update (DeepSeek desktop for Linux). Every agent, plugin and network capability of the official build stays; you can run `dsh web` locally or install the native desktop client, and your data stays on the machine.

The official desktop ships macOS and Windows only. Linux users either fall back to the Web UI or build from source. This repository closes that gap: it packages, tests and distributes Linux as a community-supported platform without removing any official desktop feature.

## What this is, and what it is not

- **It is** a downstream fork with one job: make the dsh desktop app downloadable, installable and updatable on Linux.
- **It is not** an official DeepSeek project, and it does not modify the agent core. Agent behaviour, the plugin system and the wire protocol follow upstream.

## Highlights

- **Native Linux support**: a downstream project that provides community Linux desktop packaging for the official DeepSeek desktop app, on Ubuntu, Debian, Raspberry Pi 5 and ARM servers.
- **Three package formats**: AppImage (single file, no install, supports auto-update), Debian `.deb` (native package management), and portable `.tar.gz`. Only the AppImage updates itself; `.deb` and `.tar.gz` are replaced by downloading a newer build.
- **Auto-update**: the AppImage uses `electron-updater` over HTTPS and verifies the downloaded artifact against the **sha512** recorded in the update descriptor (yml).
- **Complete features**: agent core, plugin system, network access and the Web frontend follow upstream, so Linux matches the official experience except Office document conversion.
- **Self-hosted**: run `dsh web` locally or install the desktop client; data stays on the machine, which suits privacy-sensitive and intranet deployments.
- **Open source and free**: distributed under the upstream MIT licence.

## Artifacts

Every build emits three package formats per architecture:

| Format | Use | Typical filename |
|--------|-----|------------------|
| **AppImage** | Single file, no install, auto-update | `deepseek-harness-<version>-linux-x64.AppImage` |
| **.deb** | Debian / Ubuntu package management | `deepseek-harness-<version>-linux-amd64.deb` |
| **.tar.gz** | Portable, unpack and run | `deepseek-harness-<version>-linux-x64.tar.gz` |

> Replace `<version>` with the release you install (currently `0.2.2-rc.3`).

Supported architectures: `x64` (AMD / Intel) and `arm64` (Raspberry Pi 5, Linux on Apple Silicon, ARM servers).

## Quick start

### Option 1: AppImage (recommended, supports auto-update)

1. Download the `.AppImage` for your architecture from [Releases](https://github.com/4478sc/deepseek-harness-linux/releases).
2. Install the runtime dependency; AppImage needs FUSE 2:
   ```sh
   sudo apt install libfuse2          # Debian / Ubuntu; libfuse2t64 on 24.04 and later
   # Fedora / RHEL: sudo dnf install fuse2
   ```
3. Make it executable and run it:
   ```sh
   chmod +x deepseek-harness-*-linux-x64.AppImage
   ./deepseek-harness-*-linux-x64.AppImage
   ```

### Option 2: .deb

```sh
sudo dpkg -i deepseek-harness-*-linux-x64.deb
deepseek-harness            # or start it from the application menu
```

### Option 3: .tar.gz (portable)

```sh
tar -xzf deepseek-harness-*-linux-x64.tar.gz
cd deepseek-harness-*-linux-x64
./deepseek-harness          # the launcher inside the unpacked directory
```

> On a headless machine (a remote server with VNC, for example) set `DISPLAY` first, such as `:1` under xfce4 with TigerVNC; the desktop starts on its own.

## Building from source

You need Node.js >= 24.9, pnpm 11.28.5 (pinned by `packageManager`), and `libfuse2` on the build host for AppImage assembly (`libfuse2t64` on Ubuntu 24.04+ and Debian 13).

```sh
git clone https://github.com/4478sc/deepseek-harness-linux.git
cd deepseek-harness-linux
pnpm install
cp apps/desktop/.env.linux.example apps/desktop/.env.linux   # fill in release settings as needed
pnpm --dir apps/desktop run package:linux:x64                # x64
pnpm --dir apps/desktop run package:linux:arm64              # arm64
```

Self-hosted Web mode (`dsh web`) reads the `lib/` output of every workspace package: a fresh checkout fails to start because typert-loader cannot find `lib/typert.host.js` and reports `ERR_MODULE_NOT_FOUND`, so run `pnpm run build:official` first.

The `Desktop (Linux)` workflow builds both architectures on native runners (`ubuntu-24.04` and `ubuntu-24.04-arm`); artifacts appear under Actions Artifacts or in the release it attaches.

## Auto-update

The AppImage updates through the `electron-updater` AppImage channel, with `nightly-linux.yml` as its descriptor, over HTTPS. These builds are unsigned, so an update trusts HTTPS and the feed metadata only and verifies no code signature; do not rely on it in high-trust environments.

`electron-updater` verifies the **sha512** recorded in the descriptor. For a manual download, check the `SHA256SUMS.txt` published with the release.

## Known limitations

1. **Unsigned**: Linux builds carry no code signature. This is a community build; verify the checksums published with each release.
2. **No Office document conversion**: in-app DOCX / XLSX / PPTX to PDF conversion needs the Linux native bindings of LibreOffice Kit, which this build does not ship yet, so that feature is unavailable on Linux. The remaining desktop features (agent, skills, network access, frontend) work.
3. **Upstream is in developer preview**: the official project moves fast and breaks compatibility, so this repository keeps rebasing onto upstream.
4. **No notarization and no store listing**: no system notarization and no app store process.

## Relationship to upstream

- Upstream: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT, DeepSeek-AI).
- This repository is its downstream fork. Deliberate changes stay in the Linux port: CI workflows, the electron-builder configuration, type declaration completion, POSIX launcher compatibility, desktop packaging documentation and smoke-test scripts.
- Differences outside that port come from version lag and are not yet reconciled commit by commit: this repository rebases onto upstream on the release-candidate cadence, so a lagging branch lacks some upstream files. See each release's notes for the baseline commit behind a version, and do not assume the core tracks upstream commit for commit.
- The intent is to feed the Linux packaging experience back upstream as a reference.

## Security

- Read the upstream [SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md) before running it.
- Unsigned binaries carry supply-chain risk: download only from this repository's releases and check the SHA256 sums.
- The update channel verifies no code signature; it relies on HTTPS and the feed metadata.

## Looking for this?

If you are searching for any of these, this is the project:

- **DeepSeek Linux** / **DeepSeek on Linux** / **DeepSeek desktop Linux**
- **DeepSeek client download** / **DeepSeek desktop client** / **DeepSeek desktop for Linux**
- **DeepSeek AppImage** / **DeepSeek .deb** / **Ubuntu DeepSeek** / **Debian install DeepSeek**
- **Raspberry Pi DeepSeek** / **ARM64 DeepSeek** / **DeepSeek Linux installer**
- **open-source DeepSeek client** / **self-hosted DeepSeek** / **Linux AI assistant**

> This is a **desktop client**: model capability comes from the official DeepSeek API. It bundles no offline model and does not run one locally. To use a self-hosted or third-party endpoint, configure it in the client.

## Licence

Distributed under the upstream **MIT** licence. DeepSeek Harness is developed by DeepSeek-AI and its copyright belongs to them; the Linux packaging layer is added under the same MIT licence. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
