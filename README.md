# Video Processing Tool Beta

> 基于 Electron 的 PotPlayer 视频片段提取、GIF 制作与文件管理工具

[![Version](https://img.shields.io/badge/version-5.13.1-blue.svg)](https://github.com/qwer1234-cloud/Video-Processor)
[![Platform](https://img.shields.io/badge/platform-Windows%20x64-lightgrey.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/electron-%5E25.0.0-9feaf9.svg)]()

---

## 功能特性

### 核心功能
- **视频片段提取** — 按起止时间从视频中截取片段，支持 MP4/AVI/MOV/MKV/WMV/FLV/WebM 格式
- **GIF 生成** — 手动指定时间范围生成 GIF，支持分辨率、帧率、画质调整
- **书签批量 GIF** — 读取 PotPlayer `.pbf` 书签文件，按书签对自动批量生成 GIF
- **字幕检测与提取** — 自动检测视频中的字幕流并提取为 `.srt` 文件
- **智能 7Zip 压缩** — 根据输出大小自动选择单包/分卷压缩（100MB 分卷）
- **批量文件前缀处理** — 对文件夹内所有文件批量添加或删除文件名前缀
- **分卷文件自动整理** — 压缩分卷自动按编号移动到分类子目录

### 亮点
- 支持 **多 PBF 文件同时处理**，自动匹配对应视频
- 实时进度反馈，区分 GIF 生成 / 压缩 / 整理各阶段
- 智能压缩策略：自动判断文件夹大小，<100MB 单包、>=100MB 分卷
- 特殊字符路径兼容（方括号、空格、Unicode 等）
- 压缩失败不影响 GIF 输出，确保数据安全

---

## 系统要求

| 依赖 | 说明 | 必需 |
|------|------|------|
| Windows 10/11 x64 | 操作系统 | 是 |
| FFmpeg | 视频处理、GIF 生成、字幕提取 | 是 |
| 7-Zip CLI (`7z.exe`) | 压缩功能 | 是 |
| Node.js 16+ | 开发/运行环境 | 仅开发 |

---

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/qwer1234-cloud/Video-Processor.git
cd Video-Processor

# 安装依赖
npm install

# 启动应用
npm start
```

### 打包为可执行文件

```bash
npm run build      # electron-builder 打包为便携版 .exe
npm run package    # electron-packager 打包
```

---

## 功能详解

### 1. 视频片段提取

1. 在 Function List 中选择 **"视频片段提取"**
2. 浏览选择视频文件
3. 设置开始时间（时:分:秒:毫秒）和截取时长（1-100 分钟）
4. 点击"开始处理"

输出：`D:\video_clips\`

### 2. GIF 生成（手动时间）

1. 在 Function List 中选择 **"GIF 生成"**
2. 选择视频文件，设置开始时间和时长
3. 点击"开始处理"

- 默认参数：960×540, 15fps, pal8

### 3. 书签批量 GIF 生成

1. Function List 选择 **"根据书签截取GIF"**
2. 浏览选择一个或多个 `.pbf` 书签文件
3. 系统自动解析书签、配对（两两一对）、匹配视频、生成 GIF
4. 自动计算输出大小并触发智能压缩
5. 压缩完成后自动清理 GIF 目录，分卷文件移动到分类目录

- **书签配对规则**：书签按顺序两两配对（0-1, 2-3, ...），奇数个书签末尾跳过
- **命名格式**：`{视频名}_{时-分-秒}.gif`
- **输出目录**：`D:\{PBF文件名}\`
- **压缩输出**：`D:\{PBF文件名}.7z`（分卷则为 `.7z.001`、`.7z.002` 等）

#### 动态压缩参数

| 时长 | 最大颜色数 | 压缩级别 |
|------|-----------|---------|
| ≤ 5 秒 | 64 | 6 |
| ≤ 15 秒 | 96 | 5 |
| > 15 秒 | 64 | 4 |

### 4. 字幕检测与提取

1. Function List 选择 **"字幕提取"**
2. 选择视频文件，自动检测所有字幕流
3. 每个字幕流旁出现 **"提取"按钮**，点击即可单独提取
4. 输出文件：`D:\{视频名}_{语言}_{流编号}.srt`

### 5. 7Zip 文件夹压缩

1. Function List 选择 **"7Zip压缩文件夹"**
2. 浏览选择要压缩的文件夹
3. 系统自动计算大小并选择压缩模式
4. 输出：`D:\{文件夹名}.7z`

- 压缩参数：`-mx9 -t7z`，>=100MB 时启用 `-v100m` 分卷
- 30 分钟超时保护，自动清理旧压缩文件

### 6. 批量文件前缀处理

**添加前缀：**
1. 选择 **"批量添加前缀"**，浏览选择目标文件夹
2. 点击"开始处理"，弹窗输入前缀字符串
3. 系统为所有文件添加前缀（跳过已有前缀的文件）

**删除前缀：**
1. 选择 **"批量删除前缀"**，同样操作
2. 系统移除文件名中匹配的前缀（仅当文件名以该前缀开头）

- 只处理文件，不处理子目录
- 自动避免文件名冲突，失败文件独立报错不影响其余

---

## 输出目录一览

| 操作 | 输出路径 |
|------|---------|
| 视频片段 | `D:\video_clips\` |
| 手动 GIF | `D:\` |
| 书签 GIF | `D:\{PBF文件名}\` |
| 自动压缩包 | `D:\{PBF文件名}.7z[.001/.002...]` |
| 分卷整理 | `D:\picture\{卷号}\`（如 `001\`, `002\`） |
| 字幕文件 | `D:\{视频名}_{语言}_{索引}.srt` |
| 独立压缩 | `D:\{文件夹名}.7z` |

---

## 架构概览

```
[Renderer]  ──IPC──>  [Main Process]  ──spawn──>  [FFmpeg / 7z / ffprobe]
index.html             main.js                     外部命令行工具
renderer.js            scripts/*.js
preload.js
```

- **main.js** — Electron 主进程，IPC 通信、文件操作、处理编排
- **renderer.js** — 前端逻辑，UI 事件、设置管理
- **preload.js** — 安全桥接层，`contextBridge` 暴露白名单 API
- **scripts/robust_bookmark_processor.js** — 主力书签处理器，直接调用 FFmpeg

### IPC 通道

| 通道 | 方向 | 用途 |
|------|------|------|
| `select-file` | Renderer → Main | 文件/文件夹选择 |
| `process-video` | Renderer → Main | 触发处理（视频/GIF/压缩/书签/前缀） |
| `process-video-with-prefix` | Renderer → Main | 带前缀参数的处理 |
| `parse-pbf-bookmarks` | Renderer → Main | 解析 PBF 书签文件 |
| `detect-subtitles` | Renderer → Main | 检测字幕流 |
| `extract-subtitle` | Renderer → Main | 提取指定字幕流 |
| `processing-progress` | Main → Renderer | 实时进度推送 |
| `save-settings` / `load-settings` | Renderer → Main | UI 设置持久化 |

---

## 版本历史

### v5.13.1（当前开发版本）
- 持续优化与修复

### v5.13.0
- 修复特殊字符路径（方括号、空格等）导致 7Zip 压缩失败的问题
- 路径参数加引号包围，兼容各种字符

### v5.12.0
- 修复智能分卷压缩参数顺序错误
- 添加压缩前重复文件清理机制
- 完善 `-v100m` 参数构建逻辑

### v5.10.0
- 新增批量文件前缀添加/删除功能
- UI 标签升级，默认路径调整
- 现代化前缀输入弹窗

### v5.9.0
- 分卷文件自动移动到 `D:\picture\{卷号}\` 子目录
- 自动创建目标子目录

### v5.8.0
- 书签 GIF 生成后自动触发 7Zip 压缩
- 压缩成功后自动清理原 GIF 文件夹

### v5.7.0
- 新增独立 7Zip 文件夹压缩功能
- 100MB 分卷、最高压缩级别、实时进度

### v5.6.0
- 优化 GIF 命名格式为 `视频名_时-分-秒.gif`
- 修复书签处理器命名逻辑

### v5.5.0
- 增强默认 PBF 书签处理器
- UI 优化与多项修复

---

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Electron 25 |
| 前端 | HTML / CSS / Vanilla JS |
| 后端 | Node.js |
| 视频处理 | FFmpeg / ffprobe |
| 压缩 | 7-Zip CLI |
| 打包 | electron-builder / electron-packager |

---

## 常见问题

**Q: 点击"开始处理"后无反应？**
检查系统 PATH 中是否包含 FFmpeg 和 7z.exe，应用日志见 `app.log`。

**Q: 压缩失败？**
确保对 D 盘有写入权限，磁盘空间充足，路径中特殊字符已由 v5.13.0 修复。

**Q: PBF 书签解析失败？**
确认 `.pbf` 文件为 PotPlayer 导出格式，优先使用 UTF-16LE 编码。

**Q: 字幕检测不到？**
确认视频文件包含字幕流，可使用 ffprobe 验证。

---

## 许可证

[MIT License](LICENSE)

---

## 贡献

欢迎提交 Issue 和 Pull Request。
