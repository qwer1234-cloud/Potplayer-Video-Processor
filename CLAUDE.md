# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Windows-based Electron video processing tool that allows users to extract video clips and create GIFs from video files. The application supports bookmark-based extraction from PotPlayer bookmark files (.pbf), subtitle extraction, and time-based clip extraction.

## Common Commands

```bash
# Development
npm start                    # Start the Electron application in development mode
npm run dev                 # Start with development flags

# Building and Packaging
npm run build               # Build executable using electron-builder
npm run package             # Package using electron-packager

# Testing (run these from project root)
node test_robust_processor.js     # Test robust bookmark processor
node test_debug_pbf.js           # Test PBF file processing
node scripts/test_direct_ffmpeg.js # Test direct FFmpeg processing
```

## Application Architecture

### Core Files
- `main.js` - Electron main process, handles file operations, IPC, and bookmark processing
- `renderer.js` - Frontend logic, UI controls, and event handling
- `index.html` - Main application UI
- `preload.js` - Secure bridge between main and renderer processes

### Bookmark Processing System
The application uses multiple bookmark processors in the `scripts/` directory:
- `robust_bookmark_processor.js` - Primary processor for .pbf files with enhanced error handling
- `integrated_bookmark_processor.js` - Alternative processing approach
- `ultimate_working_processor.js` - Fallback processor

### Key Features
1. **Bookmark-based extraction**: Reads PotPlayer bookmark files (.pbf) to extract multiple clips
2. **Time-based extraction**: Manual time selection for clip extraction
3. **GIF generation**: Creates optimized GIFs with configurable quality and compression
4. **Subtitle extraction**: Extracts subtitles from video files
5. **Multi-format support**: MP4, AVI, MOV, MKV, WMV, FLV, WebM

### Dependencies
- **External tools**: FFmpeg (required), gifski (optional, for GIF generation)
- **Node modules**: Electron, electron-builder, electron-packager

### Output Directories
- GIF files: `D://picture12/` (or custom directory based on PBF filename)
- Video clips: `D://video_clips/`
- Custom directories: Created based on PBF filename when processing bookmarks

### IPC Communication
Key IPC channels between main and renderer:
- `process-video` - Start video processing
- `process-bookmarks` - Process PBF bookmark files
- `select-file` - File dialog operations
- `get-video-info` - Extract video metadata
- `processing-progress` - Progress updates during processing

### Error Handling
- Comprehensive logging to `app.log` in project root
- Global error handlers for both main and renderer processes
- Retry mechanisms for FFmpeg operations
- Graceful degradation when external tools are missing

## Development Notes

### Memory Optimization
The application uses increased memory limits and garbage collection:
- `--max-old-space-size=4096`
- `--expose-gc` flag enabled

### Windows-Specific Features
- Uses Windows paths (`D://`) for output directories
- Batch file execution for FFmpeg commands
- Windows-specific file handling and path resolution

### Testing
Multiple test files are available for different components:
- `test_robust_processor.js` - Main bookmark processor tests
- `test_debug_pbf.js` - PBF file parsing tests
- `scripts/test_*.js` - Various component tests