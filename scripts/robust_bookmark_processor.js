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
                    compressionResult = await this.compressGifDirectory(this.customOutputDir, event);
                    console.log(`Auto compression completed: ${compressionResult.message}`);

                    // Delete original GIF directory after successful compression
                    console.log(`\n=== Cleaning Up Original Directory ===`);
                    this.deleteDirectoryRecursive(this.customOutputDir);

                    if (event) {
                        event.sender.send('processing-progress', {
                            current: 100,
                            total: 100,
                            message: '压缩完成，原文件夹已删除！'
                        });
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

    // Compress GIF directory using 7Zip with same settings as main function
    async compressGifDirectory(gifDirPath, event = null) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`Starting 7Zip compression for GIF directory: ${gifDirPath}`);

                // Generate output archive name based on directory name
                const dirName = path.basename(gifDirPath);
                const outputArchive = path.join('D:\\', `${dirName}.7z`);

                // 7Zip command with same compression and volume settings as main function
                // -mx9: maximum compression
                // -v100m: split into 100MB volumes
                // -t7z: use 7z format
                const args = [
                    'a',                    // add to archive
                    '-mx9',                 // maximum compression level
                    '-v100m',               // create 100MB volumes
                    '-t7z',                 // use 7z format
                    outputArchive,          // output archive path
                    gifDirPath + '\\*'      // directory contents (using * to avoid including the directory itself)
                ];

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
                            resolve({
                                success: true,
                                outputPath: outputArchive,
                                volumes: fs.existsSync(volumePattern) ? 'split into volumes' : 'single file',
                                message: `GIF文件夹压缩成功: ${dirName}`
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
}

module.exports = RobustBookmarkProcessor;