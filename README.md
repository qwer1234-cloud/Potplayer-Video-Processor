# 视频处理工具

一个基于Electron的视频片段提取和GIF制作工具。

## 功能特性

- 🎥 支持多种视频格式 (MP4, AVI, MOV, MKV, WMV, FLV, WebM)
- 🖼️ 支持输出GIF和视频片段
- ⏱️ 精确的时间控制 (小时:分钟:秒:毫秒)
- ⏰ 可调节截取时长 (1-100分钟)
- 🎨 现代化用户界面

## 系统要求

- Windows 操作系统
- Node.js 16.0 或更高版本
- FFmpeg (用于视频处理)
- gifski (用于GIF生成)

## 安装步骤

1. 安装Node.js: https://nodejs.org/
2. 安装FFmpeg并添加到系统PATH
3. 安装gifski
4. 在项目目录中运行以下命令：

```bash
cd D:\ProcessVideo
npm install
```

## 使用方法

### 开发模式运行
```bash
npm start
```

### 打包应用
```bash
npm run build
```

## 使用说明

1. **选择视频文件**: 点击"浏览..."按钮选择视频文件
2. **选择输出格式**: 选择GIF或Video格式
3. **设置开始时间**: 使用下拉框选择小时、分钟、秒，输入框输入毫秒
4. **设置截取时长**: 选择1-100分钟的时长
5. **开始处理**: 点击"开始处理"按钮

## 输出目录

- GIF文件输出到: `D://picture12`
- 视频片段输出到: `D://video_clips`

## 技术栈

- Electron
- HTML/CSS/JavaScript
- Node.js
- FFmpeg
- gifski

## 许可证

MIT License