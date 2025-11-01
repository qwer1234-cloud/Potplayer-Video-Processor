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

            // Send final progress
            if (event) {
                event.sender.send('processing-progress', {
                    current: processedCount,
                    total: processedCount,
                    message: 'Processing completed!'
                });
            }

            console.log(`\n=== Processing Complete ===`);
            console.log(`Total pairs: ${Math.floor(bookmarks.length / 2)}`);
            console.log(`Successful: ${results.filter(r => r.success).length}`);
            console.log(`Failed: ${results.filter(r => !r.success).length}`);

            return {
                success: true,
                message: `Processed ${Math.floor(bookmarks.length / 2)} bookmark pairs`,
                results: results
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
}

module.exports = RobustBookmarkProcessor;