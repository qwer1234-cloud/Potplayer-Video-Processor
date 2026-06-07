# PotPlayer Pluginization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 Electron PBF/GIF 工具演进为可从 PotPlayer 内直接触发的插件化工作流，同时保留现有桌面 UI 作为高级配置与结果查看入口。

**Architecture:** 推荐采用“薄 PotPlayer AngelScript 扩展 + 本地 companion CLI/服务”的架构。PotPlayer 扩展只负责收集当前媒体上下文、读取 `.ini` 配置并启动本地处理入口；PBF 解析、FFmpeg、7-Zip、进度记录、错误恢复继续由 Node.js companion 执行。

**Tech Stack:** PotPlayer AngelScript extension, Node.js, Electron/CLI shared core, FFmpeg, ffprobe, 7-Zip, Windows filesystem and process integration.

---

## 1. 背景与结论

当前项目已经能在 Electron 中完成以下核心能力：

- 读取 PotPlayer `.pbf` 书签文件并按 0-1、2-3 配对生成 GIF。
- 自动匹配同目录同名视频文件。
- 调用 FFmpeg/ffprobe 处理视频、GIF 与字幕。
- 调用 7-Zip 做单包或 100MB 分卷压缩。
- 通过 `main.js` IPC 统一编排处理流程，`renderer.js` 负责 UI。

如果后续要“直接 PotPlayer 插件化”，不建议把所有逻辑改写成 PotPlayer AngelScript。原因是 PotPlayer 扩展更适合做播放源解析、播放列表、媒体源、在线字幕和字幕翻译这类轻量集成；现有工具的核心是长耗时本地文件处理、批量 FFmpeg、7-Zip 和文件整理，更适合继续放在 Node.js 进程里。

推荐目标形态：

```text
PotPlayer
  Extension\Media\...\.as
      |
      | launch / HTTP / named pipe
      v
ProcessVideo Companion
  cli entrypoint or local service
      |
      v
Shared processing core
  PBF parser / bookmark pairing / video matching / FFmpeg / 7z / reports
      |
      v
Output folders and logs
```

这条路线的好处是：插件接入快、现有处理能力可复用、失败时不会卡死 PotPlayer 主进程、后续仍能保留 Electron UI。

## 2. 外部事实依据

PotPlayer 扩展生态的公开资料显示：

- PotPlayer 在 1.7.12413 版本中加入了基于 AngelScript 的扩展能力，扩展方向包括打开地址、媒体播放列表/项目、媒体源、在线字幕、在线字幕翻译。参考：<https://potplayer.org/gengxin/311.html>
- 现有 yt-dlp 扩展示例通过 `MediaPlayParse - yt-dlp.as` 安装到 `(PotPlayer installation folder)\Extension\Media\PlayParse\`，并通过 `.ini` 和外部 `yt-dlp.exe` 协作。参考：<https://github.com/hgcat-360/PotPlayer-Extension_yt-dlp>
- 现有 Twitch 扩展示例将 `Media` 目录复制到 `{PotPlayer_Folder}\Extension\`，并包含 `Media/PlayParse` 与 `Media/UrlList` 类型扩展。参考：<https://github.com/TwitchPotPlayer/TwitchPotPlayer>

这些资料说明：PotPlayer 插件化可行，但更像“脚本扩展 + 外部工具协作”，不是把复杂桌面应用完整嵌入 PotPlayer。

## 3. 目标用户流程

### 3.1 最小可用流程

1. 用户在 PotPlayer 中播放视频。
2. 用户照常使用 PotPlayer 书签功能标记片段，并启用“将书签保存到 `.pbf` 文件”。
3. 用户从 PotPlayer 扩展菜单或快捷入口触发 `ProcessVideo`。
4. 插件把当前视频路径或 `.pbf` 路径传给 companion。
5. companion 读取同目录同名 `.pbf`，生成 GIF，压缩并输出报告。
6. 用户在输出目录或 Electron UI 中查看结果。

### 3.2 完整流程

1. 插件检测当前播放媒体路径。
2. 插件按配置决定处理模式：
   - `bookmark-gif`
   - `open-electron-ui`
   - `parse-only`
   - `compress-last-output`
3. 插件启动 companion：
   - 第一阶段用 CLI 参数启动。
   - 第二阶段可改为本地 HTTP 服务或 named pipe 以提供进度。
4. companion 写入 `app.log` 和 `last-run.json`。
5. Electron UI 启动时读取 `last-run.json`，展示最近一次插件触发结果。

## 4. 推荐架构

### 4.1 插件层

**职责：**

- 安装在 PotPlayer 扩展目录。
- 读取 `ProcessVideo.ini`。
- 获取当前媒体路径，或让用户从当前目录推断 `.pbf`。
- 启动 companion CLI。
- 只做轻量日志和错误提示。

**建议文件：**

- Create: `potplayer-extension/Media/PlayParse/MediaPlayParse - ProcessVideo.as`
- Create: `potplayer-extension/Media/PlayParse/ProcessVideo_default.ini`
- Create: `potplayer-extension/README.md`

**不放在插件层的内容：**

- 不解析复杂 PBF。
- 不直接跑 FFmpeg 长命令。
- 不做压缩分卷与移动归档。
- 不维护大规模状态。

### 4.2 Companion 层

**职责：**

- 提供稳定的命令行入口。
- 接收 PotPlayer 传入的上下文。
- 复用当前处理核心。
- 写进度、报告和错误码。

**建议文件：**

- Create: `cli/processvideo-cli.js`
- Create: `core/pbf-parser.js`
- Create: `core/bookmark-workflow.js`
- Create: `core/video-matcher.js`
- Create: `core/output-report.js`
- Modify: `main.js`
- Modify: `scripts/robust_bookmark_processor.js`

### 4.3 Electron UI 层

**职责：**

- 保留当前手动选择文件、批量处理、配置、结果展示能力。
- 增加“插件触发记录”和“安装 PotPlayer 扩展”页面或按钮。
- 作为 companion 的可视化控制台。

**建议文件：**

- Modify: `index.html`
- Modify: `renderer.js`
- Modify: `preload.js`
- Modify: `styles.css`

## 5. 分阶段实施计划

### Task 1: 抽离可复用核心

**Files:**

- Create: `core/pbf-parser.js`
- Create: `core/time-utils.js`
- Create: `core/video-matcher.js`
- Test: `test-core-pbf-parser.js`
- Test: `test-core-video-matcher.js`
- Modify: `main.js`

- [ ] **Step 1: 迁移 PBF 解析函数**

  从 `main.js` 抽出以下逻辑：

  - `parsePBFBookmarks`
  - `parseBookmarkContent`
  - `convertTimestampToTime`
  - `convertTimeToSeconds`
  - `convertSecondsToTime`

  输出 CommonJS API：

  ```js
  module.exports = {
    parsePBFBookmarks,
    parseBookmarkContent,
    convertTimestampToTime,
    convertTimeToSeconds,
    convertSecondsToTime
  };
  ```

- [ ] **Step 2: 迁移视频匹配函数**

  从 `main.js` 抽出 `findVideoFileForPBF` 到 `core/video-matcher.js`：

  ```js
  module.exports = {
    findVideoFileForPBF
  };
  ```

- [ ] **Step 3: 写回归测试**

  使用现有 `sample-bookmarks.pbf` 或测试 fixture 验证：

  ```bash
  node test-core-pbf-parser.js
  node test-core-video-matcher.js
  ```

  Expected: PBF 能解析出书签，视频匹配能按同目录同名规则找到目标视频或返回明确错误。

- [ ] **Step 4: 让 `main.js` 使用核心模块**

  `main.js` 保留 IPC handler，但不再直接承载 PBF 解析细节。

### Task 2: 增加 companion CLI

**Files:**

- Create: `cli/processvideo-cli.js`
- Create: `test-cli-args.js`
- Modify: `package.json`

- [ ] **Step 1: 定义 CLI 参数**

  第一版只支持本地 PBF GIF：

  ```bash
  node cli/processvideo-cli.js bookmark-gif --video "D:\A\movie.mkv" --pbf "D:\A\movie.pbf"
  ```

  参数规则：

  - `bookmark-gif`：处理模式。
  - `--video`：当前 PotPlayer 播放的视频路径，可选。
  - `--pbf`：PBF 路径，可选；缺省时从 `--video` 同目录同名推断。
  - `--open-ui`：处理前打开 Electron UI。
  - `--report`：指定 JSON 报告输出路径。

- [ ] **Step 2: 实现参数解析**

  不新增第三方依赖，先用 Node.js 原生 `process.argv` 解析，避免引入 CLI 框架。

- [ ] **Step 3: 输出稳定错误码**

  - `0`：成功。
  - `10`：参数错误。
  - `20`：PBF 不存在或无书签。
  - `30`：视频匹配失败。
  - `40`：FFmpeg/7-Zip 处理失败。
  - `50`：未知异常。

- [ ] **Step 4: 写 `last-run.json`**

  默认写入 Electron `userData` 或项目目录下的 `runtime/last-run.json`：

  ```json
  {
    "source": "potplayer-extension",
    "mode": "bookmark-gif",
    "videoPath": "D:\\A\\movie.mkv",
    "pbfPath": "D:\\A\\movie.pbf",
    "startedAt": "2026-06-07T00:00:00.000Z",
    "finishedAt": "2026-06-07T00:01:00.000Z",
    "success": true,
    "outputs": []
  }
  ```

### Task 3: 做 PotPlayer AngelScript 薄扩展

**Files:**

- Create: `potplayer-extension/Media/PlayParse/MediaPlayParse - ProcessVideo.as`
- Create: `potplayer-extension/Media/PlayParse/ProcessVideo_default.ini`
- Create: `potplayer-extension/README.md`

- [ ] **Step 1: 定义配置文件**

  `ProcessVideo_default.ini`：

  ```ini
  [PROCESSVIDEO]
  companion_path=
  node_path=
  mode=bookmark-gif
  open_ui_after_start=0
  report_path=
  timeout_seconds=10
  ```

- [ ] **Step 2: 插件只启动 companion**

  AngelScript 扩展不直接处理视频，只做：

  - 读取当前媒体路径。
  - 组装 companion 命令。
  - 启动外部进程。
  - 显示启动成功或失败信息。

- [ ] **Step 3: 定义安装路径**

  第一版安装到：

  ```text
  {PotPlayer_Folder}\Extension\Media\PlayParse\
  ```

  后续如果 PlayParse 无法稳定拿到本地文件上下文，再评估 `Media\UrlList` 或其他扩展类型。

- [ ] **Step 4: 写插件 README**

  README 必须包含：

  - PotPlayer 版本要求。
  - 安装目录。
  - `.ini` 配置说明。
  - companion 路径配置。
  - 常见失败：权限、路径带空格、Node 未找到、PBF 不存在。

### Task 4: Electron UI 增加插件安装与结果查看

**Files:**

- Modify: `index.html`
- Modify: `renderer.js`
- Modify: `preload.js`
- Modify: `main.js`
- Modify: `styles.css`

- [ ] **Step 1: 增加“插件化”功能入口**

  在 Function List 或设置区增加：

  - 安装 PotPlayer 扩展。
  - 打开扩展目录。
  - 查看最近一次 PotPlayer 触发结果。

- [ ] **Step 2: 增加主进程 IPC**

  建议新增：

  - `install-potplayer-extension`
  - `open-potplayer-extension-folder`
  - `load-last-plugin-run`

- [ ] **Step 3: 安装扩展时不覆盖用户配置**

  安装逻辑：

  - `.as` 可覆盖更新。
  - 用户已有 `ProcessVideo.ini` 不覆盖。
  - `ProcessVideo_default.ini` 可覆盖。

- [ ] **Step 4: UI 读取 `last-run.json`**

  展示：

  - 来源视频。
  - PBF 文件。
  - 输出目录。
  - 成功/失败。
  - 错误信息。

### Task 5: 打包与发布

**Files:**

- Modify: `package.json`
- Modify: `README.md`
- Modify: `RELEASE_NOTES.md`

- [ ] **Step 1: 打包 companion**

  可选路线：

  - 开发期：PotPlayer 插件调用 `node cli/processvideo-cli.js`。
  - 发布期：用 `pkg`、`nexe` 或 Electron portable 内置入口生成 `processvideo-cli.exe`。

  第一版建议先不新增打包工具，先要求用户配置 Node 路径，降低变量。

- [ ] **Step 2: 确认 `build.files` 包含扩展目录**

  当前 `package.json` 的 build 配置排除了 `*.md`，后续如果扩展目录要随 portable 包分发，需要确认：

  - `potplayer-extension/**/*.as` 被包含。
  - `potplayer-extension/**/*.ini` 被包含。
  - README 是否需要在发布包中另行复制。

- [ ] **Step 3: 发布说明**

  README 增加：

  - 插件安装说明。
  - PotPlayer 内触发流程。
  - companion CLI 参数参考。
  - 故障排查。

## 6. 测试矩阵

### 6.1 单元测试

```bash
node test-core-pbf-parser.js
node test-core-video-matcher.js
node test-cli-args.js
```

覆盖：

- UTF-16LE PBF。
- UTF-8 fallback。
- 空书签。
- 奇数书签跳过。
- 视频同目录同名匹配。
- 缺失视频错误。
- CLI 参数缺失错误码。

### 6.2 集成测试

```bash
node cli/processvideo-cli.js bookmark-gif --video "D:\fixture\movie.mkv" --pbf "D:\fixture\movie.pbf" --report "D:\fixture\report.json"
```

Expected:

- 输出 GIF。
- 输出压缩包。
- `report.json` 包含成功状态和输出路径。
- `app.log` 有完整处理记录。

### 6.3 PotPlayer 手动验收

1. 安装插件到 PotPlayer 扩展目录。
2. 重启 PotPlayer 或 Reload files。
3. 播放 `movie.mkv`。
4. 确认同目录存在 `movie.pbf`。
5. 从 PotPlayer 触发扩展。
6. 确认 companion 启动。
7. 确认输出目录和报告生成。

## 7. 风险与处理方式

| Risk | Impact | Mitigation |
|---|---|---|
| AngelScript API 文档不完整 | 插件获取当前媒体路径可能需要试错 | 先做 Spike，只验证“能否拿到当前路径并启动 exe” |
| PotPlayer 扩展进程无法可靠管理外部 FFmpeg | PotPlayer 卡在打开状态或无法取消 | 插件只启动 companion，长任务脱离 PotPlayer 生命周期 |
| 安装目录权限不足 | Program Files 下写入失败 | UI 提供选择 PotPlayer 路径，必要时提示管理员权限 |
| 路径含中文、空格、括号 | companion 启动参数错误 | 全路径加引号，CLI 参数解析覆盖 Unicode fixture |
| 用户未启用 `.pbf` 外部保存 | 插件找不到书签 | README 和 UI 明确提示 PotPlayer 设置路径 |
| 多实例 PotPlayer 同时触发 | 输出报告互相覆盖 | report 文件名加入时间戳或进程 ID |

## 8. 推荐里程碑

### Milestone 0: Spike

目标：验证 PotPlayer `.as` 能启动本地 companion，并能传入当前媒体路径。

产出：

- 最小 `.as`。
- 最小 `processvideo-cli.js`。
- 手动测试记录。

不做：

- 不做完整 UI。
- 不做打包。
- 不做自动安装器。

### Milestone 1: CLI 化

目标：当前 PBF GIF 工作流可完全从 CLI 跑通。

产出：

- `cli/processvideo-cli.js`
- `core/*`
- 单元测试和集成测试。

### Milestone 2: 插件安装器

目标：Electron UI 可以把 `.as` 和 `.ini` 安装到 PotPlayer 扩展目录。

产出：

- 安装 IPC。
- UI 安装入口。
- 安装验证。

### Milestone 3: 发布版

目标：普通用户不需要懂 Node，也能在 PotPlayer 中触发处理。

产出：

- companion exe 或 portable 内置 companion。
- README 插件安装说明。
- Release notes。

## 9. 决策建议

建议先做 Milestone 0，不要直接重构全项目。PotPlayer 插件 API 的不确定性集中在“能否稳定获取当前媒体路径”和“从哪个扩展类别触发最自然”。只要 Spike 证明这两点成立，再抽核心和做 UI 安装器。

第一版成功标准应当很窄：

- 从 PotPlayer 触发。
- companion 找到当前视频同名 `.pbf`。
- 自动生成 GIF。
- 失败时不影响 PotPlayer 播放。

达到这个标准后，再继续做进度回传、自动安装、结果面板和打包。
