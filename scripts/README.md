# FFmpeg Bookmark Scripts

这个目录包含了基于FFmpeg的书签GIF生成脚本。

## 文件说明

### 1. `ffmpeg_bookmark_gif.bat`
基础FFmpeg GIF生成脚本，支持自定义参数。

**使用方法：**
```batch
ffmpeg_bookmark_gif.bat <video_path> <start_time> <duration> <output_path> [width] [height] [fps] [quality]
```

**参数说明：**
- `video_path`: 视频文件路径
- `start_time`: 开始时间 (格式: HH:MM:SS)
- `duration`: 持续时间（秒）
- `output_path`: 输出GIF文件路径
- `width`: GIF宽度（默认: 480）
- `height`: GIF高度（默认: 270）
- `fps`: 帧率（默认: 15）
- `quality`: 质量因子（默认: 20）

**示例：**
```batch
ffmpeg_bookmark_gif.bat "movie.mp4" "00:01:30" "5" "output.gif" 480 270 15 20
```

### 2. `generate_bookmark_scripts.js`
脚本生成器模块，用于批量生成FFmpeg处理脚本。

**主要功能：**
- 根据书签对生成批处理脚本
- 支持多种输出格式和质量选项
- 自动创建临时调色板以提高GIF质量
- 支持批量处理多个PBF文件

### 3. `bookmark_processor.js`
高级书签处理器，提供简化的API接口。

**主要功能：**
- 处理单个或多个PBF文件
- 自动查找对应的视频文件
- 生成并执行FFmpeg脚本
- 提供进度反馈

## 工作流程

1. **PBF文件解析**: 解析PotPlayer书签文件(.pbf)
2. **书签配对**: 将连续的书签配对成（开始，结束）组合
3. **脚本生成**: 为每个书签对生成FFmpeg批处理脚本
4. **批量执行**: 执行主脚本来生成所有GIF文件

## 技术特性

### 高质量GIF生成
- 使用两步法生成高质量GIF
- 第一步：生成颜色调色板
- 第二步：使用调色板创建GIF
- 支持多种抖动算法

### 智能文件匹配
- 自动查找与PBF文件同名的视频文件
- 支持常见视频格式（mp4, avi, mov, mkv等）
- 智能错误处理

### 内存管理
- 自动清理临时文件
- 优化的批处理执行
- 支持长时间运行的批量任务

## 使用示例

### 基础使用
```javascript
const BookmarkProcessor = require('./bookmark_processor');

const processor = new BookmarkProcessor({
    outputDir: 'D:\\',
    defaultWidth: 480,
    defaultHeight: 270,
    defaultFps: 15,
    defaultQuality: 20
});

// 处理单个PBF文件
const result = await processor.processSinglePBFFile(
    'path/to/bookmarks.pbf',
    bookmarksArray,
    { width: 640, height: 360 }
);
```

### 批量处理
```javascript
// 处理多个PBF文件
const result = await processor.processMultiplePBFFiles(
    pbfFilePathsArray,
    allBookmarksDataArray,
    { width: 640, height: 360, fps: 20 }
);
```

## 输出文件命名规则

生成的GIF文件按以下规则命名：
```
{视频文件名}_{书签名称}_{序号}_{时间戳}.gif
```

例如：
- `movie_精彩片段1_2024-01-15T10-30-00-000Z.gif`
- `animation_clip1_2024-01-15T10-30-05-000Z.gif`

## 错误处理

脚本包含完善的错误处理机制：
- FFmpeg未安装检测
- 视频文件存在性检查
- 磁盘空间不足警告
- 权限错误处理
- 网络路径支持

## 性能优化

1. **并行处理**: 支持多个GIF同时生成
2. **内存优化**: 自动垃圾回收和资源清理
3. **进度跟踪**: 实时反馈处理进度
4. **缓存机制**: 避免重复处理相同的书签对

## 系统要求

- Windows 10/11
- Node.js 12.0+
- FFmpeg 4.0+（必须添加到系统PATH）

## 安装FFmpeg

1. 下载FFmpeg: https://ffmpeg.org/download.html
2. 解压到任意目录
3. 将FFmpeg的bin目录添加到系统PATH环境变量
4. 在命令行中运行 `ffmpeg -version` 验证安装

## 故障排除

### 常见问题

1. **"FFmpeg not found"错误**
   - 确保FFmpeg已正确安装并添加到PATH
   - 重启命令提示符或应用程序

2. **"No video file found"错误**
   - 确保视频文件与PBF文件在同一目录
   - 检查视频文件名是否与PBF文件名匹配（除扩展名外）

3. **GIF质量问题**
   - 调整quality参数（1-31，越小质量越好）
   - 增加fps参数获得更流畅的动画
   - 使用更大的分辨率

4. **处理速度慢**
   - 减少GIF分辨率
   - 降低fps参数
   - 使用SSD存储

## 联系支持

如果遇到问题或需要功能增强，请检查应用程序日志或联系开发团队。