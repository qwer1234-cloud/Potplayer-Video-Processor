/**
 * Robust Bookmark Processor - Enhanced error handling and debugging
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class RobustBookmarkProcessor {
    constructor(options = {}) {
        this.outputDir = options.outputDir || 'D:\\';
        this.defaultWidth = options.defaultWidth || 640; // Reduced for smaller files
        this.defaultHeight = options.defaultHeight || 360; // Reduced for smaller files
        this.defaultFps = options.defaultFps || 12; // Reduced from 15 to 12
        this.defaultQuality = options.defaultQuality || 25; // Increased for better compression
        this.customOutputDir = null; // Store custom output directory based on PBF filename
        this.enableAutoCompression = options.enableAutoCompression !== false; // Default true

        // Compression optimization settings
        this.compressionLevel = options.compressionLevel || 'balanced'; // balanced: compression
        this.maxColors = options.maxColors || 128; // Reduced from 255 to 128
        this.ditherMode = options.ditherMode || 'bayer'; // Keep dithering for quality
    }

    // Set output directory based on PBF filename (for requirement 1)
    setOutputDirectoryFromPBF(pbfPath) {
        if (!pbfPath) return;

        const pbfDir = path.dirname(pbfPath);
        const pbfBaseName = path.basename(pbfPath, '.pbf');
        this.customOutputDir = path.join('D:\\', pbfBaseName);

        // Create directory if it doesn't exist
        if (!fs.existsSync(this.customOutputDir)) {
            fs.mkdirSync(this.customOutputDir, { recursive: true });
        }

        console.log(`Output directory set to: ${this.customOutputDir}`);
    }

    // Format time for new naming convention: 小时-分钟-秒 (requirement 2)
    formatTimeForFilename(timeString) {
        const timeParts = timeString.split(':');
        if (timeParts.length !== 3) return timeString; // Fallback for unexpected format

        let hours = timeParts[0];
        let minutes = timeParts[1];
        let secondsAndMs = timeParts[2];

        // Remove leading zeros from hours, minutes, and seconds
        hours = hours.replace(/^0+/, '');
        minutes = minutes.replace(/^0+/, '');
        const seconds = secondsAndMs.split('.')[0].replace(/^0+/, '');
        const milliseconds = secondsAndMs.split('.')[1] || '000';

        // Format: 小时-分钟-秒 (remove ms)
        return `${hours}-${minutes}-${seconds}`;
    }

    async processBookmarkPairs(bookmarks, videoPath, event = null, pbfPath = null) {
        console.log('\u2501 Robust Bookmark Processor Started \u2501');
        console.log(`\u2701 Bookmarks: ${bookmarks.length}`);
        console.log(`\u2701 Video: ${videoPath}`);

        // Set output directory based on PBF filename if provided
        if (pbfPath) {
            this.setOutputDirectoryFromPBF(pbfPath);
        }

        const outputDir = this.customOutputDir || this.outputDir;

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`Created output directory: ${outputDir}`);
        }

        console.log(`\u2701 Output: ${outputDir}`);

        // Verify video file exists
        if (!fs.existsSync(videoPath)) {
            const error = `Video file not found: ${videoPath}`;
            console.error(`\u2701 \u2702 ERROR: ${error}`);
            return {
                success: false,
                message: `Processing failed: ${error}`,
                error: error
            };
        }

        const results = [];
        let processedCount = 0;

        try {
            for (let i = 0; i < bookmarks.length - 1; i += 2) {
                const startBookmark = bookmarks[i];
                const endBookmark = bookmarks[i + 1];
                const duration = Math.max(1, this.calculateDuration(startBookmark.time, endBookmark.time));
                const pairIndex = Math.floor(i / 2) + 1;

                console.log(`\n=== Processing Pair ${pairIndex} ===`);
                console.log(`Start: ${startBookmark.time} -> End: ${endBookmark.time} (${duration}s)`);

                // Generate filename with new naming convention: HHminSS, remove leading zeros
                const fileBaseName = path.basename(videoPath, path.extname(videoPath));
                const formattedStartTime = this.formatTimeForFilename(startBookmark.time);
                const outputFileName = `${fileBaseName}_${formattedStartTime}.gif`;

                // Use the correct output directory
                const outputDir = this.customOutputDir || this.outputDir;
                const outputPath = path.join(outputDir, outputFileName);

                console.log(`\u2701 Output: ${outputPath}`);

                // Send progress update
                if (event) {
                    event.sender.send('processing-progress', {
                        current: processedCount + 1,
                        total: Math.floor(bookmarks.length / 2),
                        message: `Processing Pair ${pairIndex}: ${startBookmark.name || `Segment ${pairIndex}`}`
                    });
                }

                try {
                    // Method 1: Try direct FFmpeg call with robust error handling
                    console.log(`\u2701 Generating GIF directly...`);

                    // Method 1: Try direct FFmpeg call with robust error handling
                    console.log(`\u2701 Generating GIF directly...`);

                    // Dynamic compression settings based on duration
                    const compressionSettings = this.getCompressionSettings(duration);

                    const success = await this.executeFFmpegCommand([
                        '-y',
                        '-ss', startBookmark.time.split('.')[0],
                        '-t', duration.toString(),
                        '-i', videoPath,
                        '-vf', compressionSettings.videoFilter,
                        '-pix_fmt', compressionSettings.pixelFormat,
                        '-f', compressionSettings.outputFormat,
                        '-compression_level', compressionSettings.compressionLevel.toString(),
                        outputPath
                    ]);

                    // Check if file was created
                    const fileExists = fs.existsSync(outputPath);
                    const stats = success ? fs.statSync(outputPath) : null;
                    const fileSize = stats ? Math.round(stats.size / 1024) : 0;

                    results.push({
                        pairIndex: pairIndex,
                        globalPairIndex: processedCount + 1,
                        startTime: startBookmark.time,
                        endTime: endBookmark.time,
                        duration: duration,
                        name: startBookmark.name || `Segment Pair ${pairIndex}`,
                        success: success && fileExists,
                        outputPath: outputPath,
                        actualFileCreated: fileExists,
                        fileSize: fileSize
                    });

                    if (success && fileExists) {
                        console.log(`\u2701 \u2702 SUCCESS: ${outputPath} (${fileSize}KB)`);
                    } else {
                        console.log(`\u2701 \u2702 FAILED: File not created: ${outputPath}`);
                    }

                    processedCount++;

                } catch (error) {
                    console.error(`\u2701 \u2702 ERROR: Pair ${pairIndex} failed: ${error.message}`);

                    results.push({
                        pairIndex: pairIndex,
                        globalPairIndex: processedCount + 1,
                        startTime: startBookmark.time,
                        endTime: endBookmark.time,
                        duration: duration,
                        name: startBookmark.name || `Segment Pair ${pairIndex}`,
                        success: false,
                        outputPath: outputPath,
                        actualFileCreated: false,
                        error: error.message
                    });

                    // Send progress update for error
                    if (event) {
                        event.sender.send('processing-progress', {
                            current: processedCount + 1,
                            total: Math.floor(bookmarks.length / 2),
                            message: `Error in Pair ${pairIndex}: ${error.message}`
                        });
                    }

                    processedCount++;
                }

                // Small delay between processes to prevent system overload
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Send final progress for GIF generation
            if (event) {
                event.sender.send('processing-progress', {
                    current: processedCount,
                    total: processedCount,
                    message: 'GIF生成完成，准备压缩...'
                });
            }

            console.log(`\n=== GIF Generation Complete ===`);
            console.log(`Total pairs: ${Math.floor(bookmarks.length / 2)}`);
            console.log(`Successful: ${results.filter(r => r.success).length}`);
            console.log(`Failed: ${results.filter(r => !r.success).length}`);

            // Calculate total GIF size for smart compression decision
            let totalGifSize = 0;
            results.forEach(result => {
                if (result.success && result.outputPath) {
                    try {
                        const stats = fs.statSync(result.outputPath);
                        totalGifSize += stats.size;
                    } catch (error) {
                        console.log(`Warning: Could not get size for ${result.outputPath}: ${error.message}`);
                    }
                }
            });

            const totalSizeMB = Math.round(totalGifSize / 1024 / 1024 * 100) / 100;
            console.log(`Total GIF size: ${totalSizeMB} MB (${totalSizeMB < 100 ? 'No volume splitting needed' : 'Will create volumes'})`);

            // Auto-compress GIF directory if enabled and custom directory exists
            let compressionResult = null;
            if (this.enableAutoCompression && this.customOutputDir && this.customOutputDir !== this.outputDir) {
                console.log(`\n=== Starting Auto Compression ===`);
                console.log(`Compressing directory: ${this.customOutputDir}`);

                if (event) {
                    event.sender.send('processing-progress', {
                        current: 0,
                        total: 100,
                        message: '正在压缩GIF文件夹...'
                    });
                }

                try {
                    compressionResult = await this.compressGifDirectory(this.customOutputDir, totalSizeMB, event);
                    console.log(`Auto compression completed: ${compressionResult.message}`);

                    // Delete original GIF directory after successful compression
                    console.log(`\n=== Cleaning Up Original Directory ===`);
                    this.deleteDirectoryRecursive(this.customOutputDir);

                    // Move archive files to D:\picture directory
                    let fileMoveResult = null;
                    if (compressionResult.success && compressionResult.outputPath) {
                        console.log(`\n=== Moving Archive Files ===`);

                        if (event) {
                            event.sender.send('processing-progress', {
                                current: 0,
                                total: 100,
                                message: '正在移动压缩包文件到picture目录...'
                            });
                        }

                        try {
                            const compressionMode = compressionResult.compressionMode || 'single file';
                            fileMoveResult = await this.moveArchiveFilesToPicture(compressionResult.outputPath, compressionMode, event);
                            console.log(`File organization completed: ${fileMoveResult.message}`);

                            if (event) {
                                const moveType = compressionMode === 'split into volumes' ? '分卷文件' : '压缩包';
                                event.sender.send('processing-progress', {
                                    current: 100,
                                    total: 100,
                                    message: `完成！${moveType}已移动到picture目录${compressionMode === 'split into volumes' ? '对应子文件夹' : ''}`
                                });
                            }
                        } catch (moveError) {
                            console.error(`File organization failed: ${moveError.message}`);

                            if (event) {
                                event.sender.send('processing-progress', {
                                    current: 100,
                                    total: 100,
                                    message: `压缩完成但文件移动失败: ${moveError.message}`
                                });
                            }

                            fileMoveResult = {
                                success: false,
                                error: moveError.message,
                                message: `压缩完成但文件移动失败: ${moveError.message}`
                            };
                        }
                    }

                    if (event && !fileMoveResult) {
                        event.sender.send('processing-progress', {
                            current: 100,
                            total: 100,
                            message: '压缩完成，原文件夹已删除！'
                        });
                    }

                    // Combine results
                    if (fileMoveResult) {
                        compressionResult.fileMove = fileMoveResult;
                        if (fileMoveResult.success) {
                            compressionResult.message += `，${fileMoveResult.message}`;
                        }
                    }

                } catch (compressionError) {
                    console.error(`Auto compression failed: ${compressionError.message}`);

                    if (event) {
                        event.sender.send('processing-progress', {
                            current: 100,
                            total: 100,
                            message: `GIF生成完成但压缩失败: ${compressionError.message}`
                        });
                    }

                    // Don't fail the entire operation if compression fails
                    compressionResult = {
                        success: false,
                        error: compressionError.message,
                        message: `GIF生成完成但压缩失败: ${compressionError.message}`
                    };
                }
            }

            const baseMessage = `Processed ${Math.floor(bookmarks.length / 2)} bookmark pairs`;
            let finalMessage = baseMessage;

            if (compressionResult) {
                if (compressionResult.success) {
                    finalMessage = `${baseMessage}，${compressionResult.message}`;
                } else {
                    finalMessage = `${baseMessage}，${compressionResult.message}`;
                }
            }

            return {
                success: true,
                message: finalMessage,
                results: results,
                compression: compressionResult
            };

        } catch (error) {
            console.error('\u2701 \u2702 Processing failed:', error.message);
            return {
                success: false,
                message: `Processing failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async executeFFmpegCommand(args) {
        return new Promise((resolve, reject) => {
            console.log(`\u2701 FFmpeg command: ffmpeg ${args.map(arg => `"${arg}"`).join(' ')}`);

            const ffmpegProcess = spawn('ffmpeg', args);

            let stdout = '';
            let stderr = '';

            ffmpegProcess.stdout.on('data', (data) => {
                const text = data.toString();
                stdout += text;
                console.log(`FFmpeg stdout: ${text.trim()}`);
            });

            ffmpegProcess.stderr.on('data', (data) => {
                const text = data.toString();
                stderr += text;
                console.log(`FFmpeg stderr: ${text.trim()}`);
            });

            ffmpegProcess.on('close', (code) => {
                console.log(`FFmpeg process closed with code: ${code}`);
                if (code === 0) {
                    console.log(`FFmpeg execution successful`);
                    resolve(true);
                } else {
                    console.error(`FFmpeg failed with exit code ${code}`);
                    console.error(`Full stderr: ${stderr}`);
                    resolve(false); // Don't reject, just return false
                }
            });

            ffmpegProcess.on('error', (error) => {
                console.error(`FFmpeg spawn error: ${error.message}`);
                resolve(false);
            });

            // Set timeout
            const timeout = setTimeout(() => {
                console.error(`FFmpeg process timeout, killing...`);
                ffmpegProcess.kill();
                resolve(false);
            }, 300000); // 5 minutes timeout

            ffmpegProcess.on('close', () => {
                clearTimeout(timeout);
            });
        });
    }

    calculateDuration(startTime, endTime) {
        const parseTime = (timeStr) => {
            const parts = timeStr.split(':');
            const hours = parseInt(parts[0]) || 0;
            const minutes = parseInt(parts[1]) || 0;
            const secondsParts = parts[2].split('.');
            const seconds = parseInt(secondsParts[0]) || 0;
            const milliseconds = parseInt(secondsParts[1]) || 0;

            return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
        };

        const startSeconds = parseTime(startTime);
        const endSeconds = parseTime(endTime);

        return Math.max(1, Math.round(endSeconds - startSeconds));
    }

    // Get dynamic compression settings based on video duration
    getCompressionSettings(duration) {
        // Fixed resolution 960x540 and fixed fps=15 with optimized compression based on duration
        if (duration <= 5) {
            return {
                videoFilter: `fps=15,scale=960:540:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
                pixelFormat: 'pal8',
                outputFormat: 'gif',
                compressionLevel: 6,
                maxColors: 64
            };
        }
        // Default settings for medium videos
        else if (duration <= 15) {
            return {
                videoFilter: `fps=15,scale=960:540:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
                pixelFormat: 'pal8',
                outputFormat: 'gif',
                compressionLevel: 5,
                maxColors: 96
            };
        }
        // Settings for long videos
        else {
            return {
                videoFilter: `fps=15,scale=960:540:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
                pixelFormat: 'pal8',
                outputFormat: 'gif',
                compressionLevel: 4,
                maxColors: 64
            };
        }
    }

    // Get optimized pixel format based on compression
    getOptimizedPixelFormat(compressionLevel) {
        switch (compressionLevel) {
            case 5: return 'yuv420p'; // Lossless for highest compression
            case 6: return 'yuv420p'; // Good compression
            case 7: return 'yuv420p'; // Balanced
            case 9: return 'rgb24'; // Better colors with larger file size
            default: return 'yuv420p'; // Default
        }
    }

    // Compress GIF directory using 7Zip with smart volume splitting
    async compressGifDirectory(gifDirPath, totalSizeMB = 0, event = null) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`Starting 7Zip compression for GIF directory: ${gifDirPath}`);
                console.log(`Total GIF size: ${totalSizeMB} MB`);

                // Generate output archive name based on directory name
                const dirName = path.basename(gifDirPath);
                const outputArchive = path.join('D:\\', `${dirName}.7z`);

                // Remove existing archive files if they exist
                if (fs.existsSync(outputArchive)) {
                    console.log(`Removing existing archive: ${outputArchive}`);
                    fs.unlinkSync(outputArchive);
                }

                // Remove existing volume files if they exist
                for (let i = 1; i <= 100; i++) {
                    const volumeFile = path.join('D:\\', `${dirName}.7z.${i.toString().padStart(3, '0')}`);
                    if (fs.existsSync(volumeFile)) {
                        console.log(`Removing existing volume: ${volumeFile}`);
                        fs.unlinkSync(volumeFile);
                    } else {
                        break;
                    }
                }

                // Determine if volume splitting is needed
                const needsVolumeSplitting = totalSizeMB >= 100;
                console.log(`Compression mode: ${needsVolumeSplitting ? 'Volume splitting (100MB)' : 'Single archive'}`);

                // Build 7Zip command based on total size
                // -mx9: maximum compression level
                // -v100m: split into 100MB volumes (only if needed)
                // -t7z: use 7z format
                let args = [
                    'a',                    // add to archive
                    '-mx9',                 // maximum compression level
                ];

                // Add volume splitting only if total size exceeds 100MB
                if (needsVolumeSplitting) {
                    args.push('-v100m'); // Add volume option after compression level
                }

                args.push(
                    '-t7z',                 // use 7z format
                    outputArchive,          // output archive path
                    gifDirPath + '\\*'      // directory contents (using * to avoid including the directory itself)
                );

                console.log(`Executing 7z command: 7z ${args.join(' ')}`);

                const process = spawn('7z', args, {
                    cwd: 'D:\\',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: true
                });

                let output = '';
                let errorOutput = '';

                process.stdout.on('data', (data) => {
                    const text = data.toString();
                    output += text;
                    console.log(`7Zip stdout: ${text.trim()}`);

                    // Send progress updates to renderer
                    if (event && text.includes('%')) {
                        try {
                            const progressMatch = text.match(/(\d+)%/);
                            if (progressMatch) {
                                const progress = parseInt(progressMatch[1]);
                                event.sender.send('processing-progress', {
                                    current: progress,
                                    total: 100,
                                    message: `压缩进度: ${progress}%`
                                });
                            }
                        } catch (e) {
                            // Ignore progress parsing errors
                        }
                    }
                });

                process.stderr.on('data', (data) => {
                    const text = data.toString();
                    errorOutput += text;
                    console.log(`7Zip stderr: ${text.trim()}`);
                });

                process.on('close', (code) => {
                    if (code === 0) {
                        console.log(`7Zip compression completed successfully`);
                        console.log(`Output archive: ${outputArchive}`);

                        // Check if volume files were created
                        const volumePattern = outputArchive.replace('.7z', '.7z.001');
                        const volumeExists = fs.existsSync(volumePattern) || fs.existsSync(outputArchive);

                        if (volumeExists) {
                            // Check if it's actually split into volumes or single file
                            const isVolumeSplit = fs.existsSync(volumePattern);
                            const compressionMode = isVolumeSplit ? 'split into volumes' : 'single file';

                            resolve({
                                success: true,
                                outputPath: outputArchive,
                                volumes: compressionMode,
                                compressionMode: compressionMode,
                                totalSizeMB: totalSizeMB,
                                message: `GIF文件夹${totalSizeMB >= 100 ? '分卷压缩' : '压缩'}成功: ${dirName} (${totalSizeMB}MB)`
                            });
                        } else {
                            reject(new Error('7Zip completed but no output files found'));
                        }
                    } else {
                        console.log(`7Zip failed with exit code: ${code}`);
                        console.log(`Error output: ${errorOutput}`);
                        reject(new Error(`7Zip压缩失败，退出代码: ${code}\n${errorOutput}`));
                    }
                });

                process.on('error', (error) => {
                    console.log(`7Zip process error: ${error.message}`);
                    reject(new Error(`7Zip进程错误: ${error.message}\n请确保7z命令行工具已正确安装并添加到系统PATH环境变量中`));
                });

                // Set timeout for 7Zip process (30 minutes)
                const timeout = setTimeout(() => {
                    if (!process.killed) {
                        process.kill();
                        reject(new Error('7Zip压缩超时，请检查文件夹大小或减少压缩级别'));
                    }
                }, 30 * 60 * 1000); // 30 minutes

                process.on('close', () => {
                    clearTimeout(timeout);
                });

            } catch (error) {
                console.log(`7Zip compression setup error: ${error.message}`);
                reject(new Error(`7Zip压缩设置错误: ${error.message}`));
            }
        });
    }

    // Delete directory recursively
    deleteDirectoryRecursive(dirPath) {
        if (fs.existsSync(dirPath)) {
            console.log(`Deleting directory: ${dirPath}`);
            fs.rmSync(dirPath, { recursive: true, force: true });
            console.log(`Directory deleted successfully: ${dirPath}`);
        }
    }

    // Move archive files to D:\picture directory (handles both single and split archives)
    async moveArchiveFilesToPicture(archivePath, compressionMode = 'single file', event = null) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`Starting archive files organization for: ${archivePath}`);
                console.log(`Compression mode: ${compressionMode}`);

                // Ensure D:\picture directory exists
                const pictureDir = 'D:\\picture';
                if (!fs.existsSync(pictureDir)) {
                    console.log('Creating D:\\picture directory...');
                    fs.mkdirSync(pictureDir, { recursive: true });
                }

                const baseName = path.basename(archivePath, '.7z');
                const archiveDir = path.dirname(archivePath);
                let filesToMove = [];

                if (compressionMode === 'split into volumes') {
                    // Handle split volumes
                    console.log('Processing split volumes...');
                    for (let i = 1; i <= 100; i++) { // Reasonable limit
                        const volumeFile = path.join(archiveDir, `${baseName}.7z.${i.toString().padStart(3, '0')}`);
                        if (fs.existsSync(volumeFile)) {
                            filesToMove.push(volumeFile);
                        } else {
                            break; // Stop when no more volume files found
                        }
                    }
                    console.log(`Found ${filesToMove.length} volume files to move to subdirectories`);
                } else {
                    // Handle single archive file
                    console.log('Processing single archive file...');
                    const mainArchiveFile = path.join(archiveDir, `${baseName}.7z`);
                    if (fs.existsSync(mainArchiveFile)) {
                        filesToMove.push(mainArchiveFile);
                    }
                    console.log(`Found single archive file to move: ${mainArchiveFile}`);
                }

                if (filesToMove.length === 0) {
                    reject(new Error('No archive files found to move'));
                    return;
                }

                let movedFiles = [];
                let errors = [];

                // Process each file based on compression mode
                for (let i = 0; i < filesToMove.length; i++) {
                    const fileToMove = filesToMove[i];

                    try {
                        const fileName = path.basename(fileToMove);

                        if (compressionMode === 'split into volumes') {
                            // Split volumes: move to numbered subdirectories
                            const volumeMatch = fileName.match(/\.7z\.(\d+)$/);
                            if (volumeMatch) {
                                const volumeNumber = volumeMatch[1];
                                const targetSubdir = path.join(pictureDir, volumeNumber);

                                // Create target subdirectory if it doesn't exist
                                if (!fs.existsSync(targetSubdir)) {
                                    console.log(`Creating subdirectory: ${targetSubdir}`);
                                    fs.mkdirSync(targetSubdir, { recursive: true });
                                }

                                const targetPath = path.join(targetSubdir, fileName);
                                console.log(`Moving ${fileName} to ${targetSubdir}`);

                                // Use synchronous move to ensure completion
                                fs.renameSync(fileToMove, targetPath);

                                movedFiles.push({
                                    originalPath: fileToMove,
                                    targetPath: targetPath,
                                    volumeNumber: volumeNumber,
                                    size: fs.statSync(targetPath).size,
                                    type: 'volume'
                                });

                                // Send progress update
                                if (event) {
                                    const progress = Math.round(((i + 1) / filesToMove.length) * 100);
                                    event.sender.send('processing-progress', {
                                        current: progress,
                                        total: 100,
                                        message: `移动分卷文件: ${volumeNumber} (${i + 1}/${filesToMove.length})`
                                    });
                                }

                                console.log(`Successfully moved ${fileName} to subdirectory ${volumeNumber}`);
                            }
                        } else {
                            // Single archive: move directly to picture directory
                            const targetPath = path.join(pictureDir, fileName);
                            console.log(`Moving ${fileName} to picture directory`);

                            // Use synchronous move to ensure completion
                            fs.renameSync(fileToMove, targetPath);

                            movedFiles.push({
                                originalPath: fileToMove,
                                targetPath: targetPath,
                                volumeNumber: null,
                                size: fs.statSync(targetPath).size,
                                type: 'single'
                            });

                            // Send progress update
                            if (event) {
                                const progress = Math.round(((i + 1) / filesToMove.length) * 100);
                                event.sender.send('processing-progress', {
                                    current: progress,
                                    total: 100,
                                    message: `移动压缩包: ${fileName} (${i + 1}/${filesToMove.length})`
                                });
                            }

                            console.log(`Successfully moved ${fileName} to picture directory`);
                        }

                    } catch (moveError) {
                        const errorMsg = `Failed to move ${path.basename(fileToMove)}: ${moveError.message}`;
                        console.error(errorMsg);
                        errors.push(errorMsg);
                    }
                }

                console.log(`\n=== Archive Files Organization Complete ===`);
                console.log(`Successfully moved: ${movedFiles.length} files`);
                console.log(`Compression mode: ${compressionMode}`);
                console.log(`Errors: ${errors.length} files`);

                if (movedFiles.length > 0) {
                    console.log('\nMoved files details:');
                    movedFiles.forEach(movedFile => {
                        if (movedFile.type === 'volume') {
                            console.log(`  📁 ${movedFile.volumeNumber}/: ${path.basename(movedFile.targetPath)} (${Math.round(movedFile.size / 1024 / 1024)}MB)`);
                        } else {
                            console.log(`  📁 picture\\: ${path.basename(movedFile.targetPath)} (${Math.round(movedFile.size / 1024 / 1024)}MB)`);
                        }
                    });
                }

                if (errors.length > 0) {
                    console.log('\nErrors encountered:');
                    errors.forEach(error => console.log(`  ❌ ${error}`));
                }

                if (movedFiles.length === 0) {
                    reject(new Error('No files were successfully moved'));
                } else {
                    const moveType = compressionMode === 'split into volumes' ? '分卷文件' : '压缩包';
                    resolve({
                        success: true,
                        movedFiles: movedFiles,
                        errors: errors,
                        totalProcessed: filesToMove.length,
                        totalMoved: movedFiles.length,
                        message: `成功移动 ${movedFiles.length} 个${moveType}到 picture 目录`
                    });
                }

            } catch (error) {
                console.error(`Volume files organization failed: ${error.message}`);
                reject(new Error(`分卷文件整理失败: ${error.message}`));
            }
        });
    }
}

module.exports = RobustBookmarkProcessor;