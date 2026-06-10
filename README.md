# Video Processing Tool Beta / 视频处理工具

[English](#english) | [中文](#chinese)

[![Version](https://img.shields.io/badge/version-5.13.1-blue.svg)](https://github.com/qwer1234-cloud/Potplayer-Video-Processor)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/electron-%5E25.0.0-9feaf9.svg)]()

---

<a name="english"></a>
## English

An Electron-based desktop tool for video clip extraction, GIF creation, and file management — designed for use with PotPlayer bookmark files.

### Features

#### Core Features
- **Video Clip Extraction** — Extract segments from videos by start time and duration. Supports MP4, AVI, MOV, MKV, WMV, FLV, WebM.
- **GIF Generation** — Create GIFs from manual time ranges with configurable resolution, framerate, and quality.
- **Batch Bookmark GIF** — Automatically generate multiple GIFs from PotPlayer `.pbf` bookmark files with smart bookmark pairing.
- **Subtitle Detection & Extraction** — Detect subtitle streams in videos and extract them as `.srt` files.
- **Smart 7Zip Compression** — Auto-select single or split-volume compression (100MB volumes) based on output size.
- **Batch Prefix Processing** — Add or remove filename prefixes across all files in a folder.
- **Auto File Organization** — Split archive volumes are automatically sorted into numbered subdirectories.

#### Highlights
- **Multi-PBF support** — Process multiple `.pbf` files at once with automatic video matching
- **Real-time progress** — Distinct progress indicators for GIF generation / compression / organization stages
- **Smart compression** — Auto-detects folder size: single archive for <100MB, split volumes for >=100MB
- **Special character compatibility** — Handles paths with brackets, spaces, Unicode characters (fixed in v5.13.0)
- **Data safety** — Failed compression never deletes generated GIFs

### System Requirements

| Dependency | Purpose | Required |
|------------|---------|----------|
| Windows 10/11 x64 | Operating system | Yes |
| FFmpeg | Video processing, GIF generation, subtitle extraction | Yes |
| 7-Zip CLI (`7z.exe`) | Compression | Yes |
| Node.js 16+ | Development/runtime | Dev only |

### Quick Start

```bash
# Clone the repo
git clone https://github.com/qwer1234-cloud/Potplayer-Video-Processor.git
cd Potplayer-Video-Processor

# Install dependencies
npm install

# Launch the app
npm start
```

#### Build

```bash
npm run build      # electron-builder → portable .exe
npm run package    # electron-packager
```

### PotPlayer Extension Usage

The packaged app can be used as a PotPlayer PlayParse extension companion. When PotPlayer opens a local video, the extension checks whether a same-directory, same-name `.pbf` bookmark file exists. If it does, it launches ProcessVideo in CLI mode and generates GIFs from the bookmark time pairs.

#### Install From the App

1. Build or download `Video Processing Tool Beta 5.13.1.exe`.
2. Open the app and find the **PotPlayer Plugin** panel.
3. Click **Install**. If PotPlayer is installed under `C:\Program Files`, click **Install Admin** and approve the Windows UAC prompt.
4. Restart PotPlayer after installation.

The extension files are installed to:

```text
C:\Program Files\DAUM\PotPlayer\Extension\Media\PlayParse\
```

The main files are:

- `MediaPlayParse - ProcessVideo.as` - PotPlayer AngelScript bridge.
- `ProcessVideo_default.ini` - default plugin configuration.
- `ProcessVideo.ini` - local user configuration; the installer preserves an existing file.

#### Install From Source

```bash
npm run install-potplayer-extension -- --potplayer "C:\Program Files\DAUM\PotPlayer" --companion "D:\ProcessVideo-Beta\dist\Video Processing Tool Beta 5.13.1.exe" --node ""
```

If the command fails with `EPERM`, run the app's **Install Admin** button or start the command from an elevated terminal.

#### Required File Layout

For automatic GIF generation, the video and bookmark file must be in the same folder and share the same base name:

```text
C:\Users\sunhao\Desktop\ToWatch\太平年.E01.mp4
C:\Users\sunhao\Desktop\ToWatch\太平年.E01.pbf
```

When the video is opened in PotPlayer, the extension runs the packaged companion like this:

```text
"Video Processing Tool Beta 5.13.1.exe" --processvideo-cli bookmark-gif --video "<current video>"
```

The CLI infers the `.pbf` path, parses bookmark pairs, generates GIFs, and writes a report.

#### Configuration

`ProcessVideo.ini` supports these settings:

```ini
[PROCESSVIDEO]
companion_path=D:\ProcessVideo-Beta\dist\Video Processing Tool Beta 5.13.1.exe
node_path=
mode=bookmark-gif
open_ui_after_start=0
report_path=C:\Users\sunhao\AppData\Roaming\video-processor-beta\runtime\last-run.json
timeout_seconds=10
show_launch_message=1
cooldown_seconds=30
require_pbf_exists=1
async_launch=1
```

Key fields:

- `companion_path`: packaged exe path, or `cli/processvideo-cli.js` during development.
- `node_path`: leave empty for packaged exe; use `node` for the development CLI.
- `report_path`: JSON report written after each plugin run.
- `cooldown_seconds`: prevents repeated PotPlayer parse events from starting duplicate jobs.
- `require_pbf_exists=1`: only runs when a matching `.pbf` exists next to the video.
- `async_launch=1`: starts the companion in the background so PotPlayer does not wait for GIF generation during media parsing.

#### Output and Verification

- GIF output follows the normal bookmark GIF rule: `D:\{PBF_Filename}\`.
- Last plugin report: `C:\Users\sunhao\AppData\Roaming\video-processor-beta\runtime\last-run.json`.
- A successful report contains `"success": true` and an `outputs` array with generated GIF paths.
- If the same video and `.pbf` are opened again and the previous GIF outputs still exist, the CLI skips regeneration and writes a skipped report.

Notes:

- FFmpeg is still required for GIF generation. The packaged build can use the bundled `tools\ffmpeg\bin` path.
- 7-Zip is only needed for archive compression. GIF generation can succeed even if compression fails because `7z.exe` is missing.
- PotPlayer PlayParse extensions are parse-time hooks, not toolbar buttons. The trigger happens when PotPlayer loads/parses the media item.

### Feature Guide

#### 1. Video Clip Extraction
1. Select **"视频片段提取"** from the Function List
2. Browse and select a video file
3. Set start time (H:M:S:ms) and duration (1-100 minutes)
4. Click "开始处理"

Output: `D:\video_clips\`

#### 2. Manual GIF Generation
1. Select **"GIF 生成"** from the Function List
2. Choose a video file, set start time and duration
3. Click "开始处理"

Default parameters: 960×540, 15fps, pal8 pixel format.

#### 3. Batch Bookmark GIF Generation
1. Select **"根据书签截取GIF"** from the Function List
2. Browse and select one or more `.pbf` bookmark files
3. The app auto-parses bookmarks, pairs them (0-1, 2-3, ...), matches videos, and generates GIFs
4. Output size is calculated and smart compression is triggered automatically
5. GIF directory is cleaned up after compression; split volumes are moved to organized subdirectories

- **Pairing rule**: Bookmarks paired sequentially (0-1, 2-3, ...); odd last bookmark is skipped
- **Naming**: `{VideoName}_{H-m-s}.gif`
- **Output**: `D:\{PBF_Filename}\`
- **Archive**: `D:\{PBF_Filename}.7z` (or `.7z.001`, `.7z.002` for split volumes)

##### Dynamic Compression Parameters

| Duration | Max Colors | Compression Level |
|----------|-----------|-------------------|
| ≤ 5 sec | 64 | 6 |
| ≤ 15 sec | 96 | 5 |
| > 15 sec | 64 | 4 |

#### 4. Subtitle Detection & Extraction
1. Select **"字幕提取"** from the Function List
2. Choose a video file — all subtitle streams are auto-detected
3. Click the **extract button** next to any stream to extract it individually
4. Output: `D:\{VideoName}_{Language}_{StreamIndex}.srt`

#### 5. Folder Compression (7Zip)
1. Select **"7Zip压缩文件夹"** from the Function List
2. Browse and select a folder to compress
3. The app auto-calculates size and selects compression mode
4. Output: `D:\{FolderName}.7z`

- Parameters: `-mx9 -t7z`, enables `-v100m` for >=100MB
- 30-minute timeout with stale file cleanup

#### 6. Batch Prefix Processing

**Add prefix:**
1. Select **"批量添加前缀"**, browse to target folder
2. Click "开始处理", enter prefix in the dialog
3. All files get the prefix (files already having it are skipped)

**Remove prefix:**
1. Select **"批量删除前缀"**, same workflow
2. Prefix is removed only if the filename starts with it

- Files only (subdirectories skipped); auto conflict avoidance

### Output Directory Reference

| Operation | Output Path |
|-----------|------------|
| Video clips | `D:\video_clips\` |
| Manual GIF | `D:\` |
| Bookmark GIFs | `D:\{PBF_Filename}\` |
| Auto archive | `D:\{PBF_Filename}.7z[.001/.002...]` |
| Split volume organization | `D:\picture\{vol}\` (e.g. `001\`, `002\`) |
| Subtitles | `D:\{VideoName}_{Lang}_{Index}.srt` |
| Standalone compression | `D:\{FolderName}.7z` |

### Architecture

```
[Renderer]  ──IPC──>  [Main Process]  ──spawn──>  [FFmpeg / 7z / ffprobe]
index.html             main.js                     External CLI tools
renderer.js            scripts/*.js
preload.js
```

- **main.js** — Electron main process: IPC handlers, file operations, processing orchestration
- **renderer.js** — Frontend logic: UI events, settings persistence
- **preload.js** — Secure bridge: whitelisted API via `contextBridge`
- **scripts/robust_bookmark_processor.js** — Primary bookmark processor using direct FFmpeg spawn

#### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `select-file` | Renderer → Main | File/folder selection dialog |
| `process-video` | Renderer → Main | Trigger processing (video/GIF/compress/bookmark/prefix) |
| `process-video-with-prefix` | Renderer → Main | Processing with explicit prefix parameter |
| `parse-pbf-bookmarks` | Renderer → Main | Parse PBF bookmark files |
| `detect-subtitles` | Renderer → Main | Detect subtitle streams via ffprobe |
| `extract-subtitle` | Renderer → Main | Extract a specific subtitle stream |
| `processing-progress` | Main → Renderer | Real-time progress updates |
| `save-settings` / `load-settings` | Renderer → Main | UI settings persistence |

### Version History

#### v5.13.1 (Current)
- Ongoing improvements and fixes

#### v5.13.0
- Fixed 7Zip compression failure caused by special characters in paths (brackets, spaces, etc.)
- Path arguments are now quoted for proper shell handling

#### v5.12.0
- Fixed incorrect parameter ordering in smart split-volume compression
- Added stale file cleanup before compression
- Improved `-v100m` argument construction logic

#### v5.10.0
- New batch filename prefix add/remove functionality
- UI label updates and default path adjustments
- Modern prefix input dialog

#### v5.9.0
- Split volumes auto-moved to `D:\picture\{vol}\` subdirectories
- Auto-create target subdirectories

#### v5.8.0
- Auto 7Zip compression after bookmark GIF generation
- Auto cleanup of original GIF folder after successful compression

#### v5.7.0
- New standalone 7Zip folder compression feature
- 100MB split volumes, maximum compression, real-time progress

#### v5.6.0
- Optimized GIF naming: `{VideoName}_{H-m-s}.gif`
- Fixed bookmark processor naming logic

#### v5.5.0
- Enhanced default PBF bookmark processor
- UI improvements and bug fixes

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Electron 25 |
| Frontend | HTML / CSS / Vanilla JS |
| Backend | Node.js |
| Video processing | FFmpeg / ffprobe |
| Compression | 7-Zip CLI |
| Packaging | electron-builder / electron-packager |

### FAQ

**Q: Nothing happens when I click "开始处理"?**
Check that FFmpeg and 7z.exe are in your system PATH. Check `app.log` for detailed errors.

**Q: Compression fails?**
Ensure write access to D: drive, sufficient disk space. Special character path issues are fixed in v5.13.0.

**Q: PBF bookmark parsing fails?**
Confirm the `.pbf` file is in PotPlayer export format. UTF-16LE encoding is expected.

**Q: No subtitles detected?**
Verify the video file contains subtitle streams. Use ffprobe to confirm.

### License

[MIT License](LICENSE)

### Contributing

Issues and Pull Requests are welcome.

---

<a name="chinese"></a>
## 中文

基于 Electron 的桌面工具，用于视频片段提取、GIF 制作与文件管理，专为配合 PotPlayer 书签文件设计。

### 功能特性

#### 核心功能
- **视频片段提取** — 按起止时间从视频中截取片段，支持 MP4/AVI/MOV/MKV/WMV/FLV/WebM 格式
- **GIF 生成** — 手动指定时间范围生成 GIF，可调分辨率、帧率与画质
- **书签批量 GIF** — 读取 PotPlayer `.pbf` 书签文件，自动配对并批量生成 GIF
- **字幕检测与提取** — 自动检测视频字幕流并提取为 `.srt` 文件
- **智能 7Zip 压缩** — 根据输出大小自动选择单包或分卷压缩（100MB 分卷）
- **批量文件前缀处理** — 对文件夹内所有文件批量添加或删除文件名前缀
- **分卷自动整理** — 压缩分卷按编号自动移动到分类子目录

#### 亮点
- **多 PBF 支持** — 可同时处理多个 `.pbf` 文件，自动匹配对应视频
- **实时进度** — 区分 GIF 生成 / 压缩 / 整理各阶段的进度反馈
- **智能压缩** — 自动判断文件夹大小：<100MB 单包，>=100MB 分卷
- **特殊字符兼容** — 支持含方括号、空格、Unicode 字符的路径（v5.13.0 修复）
- **数据安全** — 压缩失败不会删除已生成的 GIF 文件

### 系统要求

| 依赖 | 说明 | 必需 |
|------|------|------|
| Windows 10/11 x64 | 操作系统 | 是 |
| FFmpeg | 视频处理、GIF 生成、字幕提取 | 是 |
| 7-Zip CLI (`7z.exe`) | 压缩功能 | 是 |
| Node.js 16+ | 开发与运行环境 | 仅开发 |

### 快速开始

```bash
# 克隆仓库
git clone https://github.com/qwer1234-cloud/Potplayer-Video-Processor.git
cd Potplayer-Video-Processor

# 安装依赖
npm install

# 启动应用
npm start
```

#### 打包

```bash
npm run build      # electron-builder → 便携版 .exe
npm run package    # electron-packager
```

### PotPlayer 插件使用说明

打包后的 `Video Processing Tool Beta 5.13.1.exe` 可以作为 PotPlayer PlayParse 插件的伴随程序使用。PotPlayer 打开本地视频时，插件会检查视频同目录下是否存在同名 `.pbf` 书签文件；如果存在，就自动调用 ProcessVideo 的 CLI 模式，按书签时间对生成 GIF。

#### 从应用内安装

1. 构建或下载 `Video Processing Tool Beta 5.13.1.exe`。
2. 打开应用，在界面中找到 **PotPlayer Plugin** 面板。
3. 点击 **Install**。如果 PotPlayer 安装在 `C:\Program Files` 下，点击 **Install Admin** 并确认 Windows UAC 弹窗。
4. 安装完成后重启 PotPlayer。

插件安装目录：

```text
C:\Program Files\DAUM\PotPlayer\Extension\Media\PlayParse\
```

主要文件：

- `MediaPlayParse - ProcessVideo.as`：PotPlayer AngelScript 桥接脚本。
- `ProcessVideo_default.ini`：默认插件配置。
- `ProcessVideo.ini`：用户本地配置；安装器不会覆盖已有文件。

#### 从源码安装

```bash
npm run install-potplayer-extension -- --potplayer "C:\Program Files\DAUM\PotPlayer" --companion "D:\ProcessVideo-Beta\dist\Video Processing Tool Beta 5.13.1.exe" --node ""
```

如果遇到 `EPERM`，说明没有 Program Files 写入权限，请使用应用里的 **Install Admin**，或在管理员终端里执行安装命令。

#### 文件放置规则

自动生成 GIF 时，视频和书签文件必须在同一目录，并且主文件名一致：

```text
C:\Users\sunhao\Desktop\ToWatch\太平年.E01.mp4
C:\Users\sunhao\Desktop\ToWatch\太平年.E01.pbf
```

PotPlayer 打开视频后，插件会调用：

```text
"Video Processing Tool Beta 5.13.1.exe" --processvideo-cli bookmark-gif --video "<当前视频路径>"
```

CLI 会自动推断 `.pbf` 路径，解析书签时间对，生成 GIF，并写入运行报告。

#### 配置项

`ProcessVideo.ini` 示例：

```ini
[PROCESSVIDEO]
companion_path=D:\ProcessVideo-Beta\dist\Video Processing Tool Beta 5.13.1.exe
node_path=
mode=bookmark-gif
open_ui_after_start=0
report_path=C:\Users\sunhao\AppData\Roaming\video-processor-beta\runtime\last-run.json
timeout_seconds=10
show_launch_message=1
cooldown_seconds=30
require_pbf_exists=1
async_launch=1
```

关键配置：

- `companion_path`：打包 exe 路径；开发模式下也可以指向 `cli/processvideo-cli.js`。
- `node_path`：打包 exe 留空；开发 CLI 使用 `node`。
- `report_path`：每次插件运行后的 JSON 报告路径。
- `cooldown_seconds`：避免 PotPlayer 重复解析同一个视频时多次启动任务。
- `require_pbf_exists=1`：只有视频旁边存在同名 `.pbf` 时才触发。
- `async_launch=1`：后台启动 companion，避免 PotPlayer 媒体解析等待 GIF 生成完成。

#### 输出与验证

- GIF 输出遵循书签 GIF 规则：`D:\{PBF文件名}\`。
- 插件最近一次运行报告：`C:\Users\sunhao\AppData\Roaming\video-processor-beta\runtime\last-run.json`。
- 成功时报告里会包含 `"success": true`，并在 `outputs` 数组中列出生成的 GIF。
- 如果再次打开同一个视频，且视频、`.pbf` 和上次 GIF 输出都未变化，CLI 会跳过重复生成并写入 skipped 报告。

注意：

- GIF 生成仍然依赖 FFmpeg。打包版本可以使用随包的 `tools\ffmpeg\bin`。
- 7-Zip 只影响压缩归档；即使缺少 `7z.exe`，GIF 本身仍可能已经生成成功。
- PotPlayer PlayParse 插件是媒体解析时触发的扩展，不是工具栏按钮；触发时机是 PotPlayer 加载或解析视频时。

### 功能详解

#### 1. 视频片段提取
1. 在 Function List 中选择 **"视频片段提取"**
2. 浏览选择视频文件
3. 设置开始时间（时:分:秒:毫秒）和截取时长（1-100 分钟）
4. 点击"开始处理"

输出：`D:\video_clips\`

#### 2. 手动 GIF 生成
1. 在 Function List 中选择 **"GIF 生成"**
2. 选择视频文件，设置开始时间和时长
3. 点击"开始处理"

默认参数：960×540, 15fps, pal8 像素格式。

#### 3. 书签批量 GIF 生成
1. Function List 选择 **"根据书签截取GIF"**
2. 浏览选择一个或多个 `.pbf` 书签文件
3. 系统自动解析书签、配对（两两一组）、匹配视频、生成 GIF
4. 自动计算输出大小并触发智能压缩
5. 压缩完成后清理 GIF 目录，分卷文件移动到分类子目录

- **配对规则**：书签按顺序两两配对（0-1, 2-3, ...），奇数个时最后一个跳过
- **命名格式**：`{视频名}_{时-分-秒}.gif`
- **输出目录**：`D:\{PBF文件名}\`
- **压缩包**：`D:\{PBF文件名}.7z`（分卷为 `.7z.001`、`.7z.002` 等）

##### 动态压缩参数

| 时长 | 最大颜色数 | 压缩级别 |
|------|-----------|---------|
| ≤ 5 秒 | 64 | 6 |
| ≤ 15 秒 | 96 | 5 |
| > 15 秒 | 64 | 4 |

#### 4. 字幕检测与提取
1. Function List 选择 **"字幕提取"**
2. 选择视频文件，自动检测所有字幕流
3. 每个字幕流旁出现 **提取按钮**，点击即可单独提取
4. 输出：`D:\{视频名}_{语言}_{流编号}.srt`

#### 5. 7Zip 文件夹压缩
1. Function List 选择 **"7Zip压缩文件夹"**
2. 浏览选择要压缩的文件夹
3. 系统自动计算大小并选择压缩模式
4. 输出：`D:\{文件夹名}.7z`

- 参数：`-mx9 -t7z`，>=100MB 时启用 `-v100m` 分卷
- 30 分钟超时保护，自动清理旧压缩文件

#### 6. 批量文件前缀处理

**添加前缀：**
1. 选择 **"批量添加前缀"**，浏览选择目标文件夹
2. 点击"开始处理"，在弹窗中输入前缀
3. 所有文件添加前缀（已有该前缀的自动跳过）

**删除前缀：**
1. 选择 **"批量删除前缀"**，流程相同
2. 仅当文件名以该前缀开头时才会移除

- 只处理文件，跳过子目录；自动避免文件名冲突

### 输出目录一览

| 操作 | 输出路径 |
|------|---------|
| 视频片段 | `D:\video_clips\` |
| 手动 GIF | `D:\` |
| 书签 GIF | `D:\{PBF文件名}\` |
| 自动压缩包 | `D:\{PBF文件名}.7z[.001/.002...]` |
| 分卷整理 | `D:\picture\{卷号}\`（如 `001\`, `002\`） |
| 字幕文件 | `D:\{视频名}_{语言}_{索引}.srt` |
| 独立压缩 | `D:\{文件夹名}.7z` |

### 架构概览

```
[Renderer]  ──IPC──>  [Main Process]  ──spawn──>  [FFmpeg / 7z / ffprobe]
index.html             main.js                     外部命令行工具
renderer.js            scripts/*.js
preload.js
```

- **main.js** — Electron 主进程：IPC 通信、文件操作、处理编排
- **renderer.js** — 前端逻辑：UI 事件、设置持久化
- **preload.js** — 安全桥接层：通过 `contextBridge` 暴露白名单 API
- **scripts/robust_bookmark_processor.js** — 主力书签处理器，直接调用 FFmpeg

#### IPC 通道

| 通道 | 方向 | 用途 |
|------|------|------|
| `select-file` | Renderer → Main | 文件/文件夹选择对话框 |
| `process-video` | Renderer → Main | 触发处理（视频/GIF/压缩/书签/前缀） |
| `process-video-with-prefix` | Renderer → Main | 带前缀参数的处理 |
| `parse-pbf-bookmarks` | Renderer → Main | 解析 PBF 书签文件 |
| `detect-subtitles` | Renderer → Main | 通过 ffprobe 检测字幕流 |
| `extract-subtitle` | Renderer → Main | 提取指定字幕流 |
| `processing-progress` | Main → Renderer | 实时进度推送 |
| `save-settings` / `load-settings` | Renderer → Main | UI 设置持久化 |

### 版本历史

#### v5.13.1（当前版本）
- 持续优化与修复

#### v5.13.0
- 修复特殊字符路径（方括号、空格等）导致 7Zip 压缩失败的问题
- 路径参数加引号包围，兼容各类特殊字符

#### v5.12.0
- 修复智能分卷压缩参数顺序错误
- 添加压缩前重复文件清理机制
- 完善 `-v100m` 参数构建逻辑

#### v5.10.0
- 新增批量文件前缀添加/删除功能
- UI 标签升级，默认路径调整
- 现代化前缀输入弹窗

#### v5.9.0
- 分卷文件自动移动到 `D:\picture\{卷号}\` 子目录
- 自动创建目标子目录

#### v5.8.0
- 书签 GIF 生成后自动触发 7Zip 压缩
- 压缩成功后自动清理原 GIF 文件夹

#### v5.7.0
- 新增独立 7Zip 文件夹压缩功能
- 100MB 分卷、最高压缩级别、实时进度

#### v5.6.0
- 优化 GIF 命名格式为 `{视频名}_{时-分-秒}.gif`
- 修复书签处理器命名逻辑

#### v5.5.0
- 增强默认 PBF 书签处理器
- UI 优化与多项修复

### 技术栈

| 层 | 技术 |
|------|------|
| 框架 | Electron 25 |
| 前端 | HTML / CSS / Vanilla JS |
| 后端 | Node.js |
| 视频处理 | FFmpeg / ffprobe |
| 压缩 | 7-Zip CLI |
| 打包 | electron-builder / electron-packager |

### 常见问题

**Q：点击"开始处理"后无反应？**
检查系统 PATH 中是否包含 FFmpeg 和 7z.exe，查看 `app.log` 了解详细错误信息。

**Q：压缩失败？**
确保对 D 盘有写入权限，磁盘空间充足。特殊字符路径问题已在 v5.13.0 中修复。

**Q：PBF 书签解析失败？**
确认 `.pbf` 文件为 PotPlayer 导出格式，编码应为 UTF-16LE。

**Q：检测不到字幕？**
确认视频文件包含字幕流，可用 ffprobe 验证。

### 许可证

[MIT License](LICENSE)

### 贡献

欢迎提交 Issue 和 Pull Request。
