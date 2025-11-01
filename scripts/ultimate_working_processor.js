/**
 * Ultimate Working Bookmark Processor - Definitive working solution
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class UltimateWorkingProcessor {
    constructor(options = {}) {
        this.outputDir = options.outputDir || 'D:\\';
        this.defaultWidth = options.defaultWidth || 480;
        this.defaultHeight = options.defaultHeight || 270;
        this.defaultFps = options.defaultFps || 15;
        this.defaultQuality = options.defaultQuality || 20;
    }

    // Format time for filename: 小时-分钟-秒
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

        // Format: 小时-分钟-秒 (remove ms)
        return `${hours}-${minutes}-${seconds}`;
    }

    async processBookmarkPairs(bookmarks, videoPath, event = null) {
        console.log(`\u2501 Ultimate Working Processor Started \u2501`);
        console.log(`\u2701 \u4e66B\u4e66B\u4e66B: ${bookmarks.length}`);
        console.log(`\u2701 \u89c6\u5f55 Video: ${videoPath}`);
        console.log(`\u2701 \u8f93\u51fa: ${this.outputDir}`);

        const results = [];
        let processedCount = 0;

        try {
            for (let i = 0; i < bookmarks.length - 1; i += 2) {
                const startBookmark = bookmarks[i];
                const endBookmark = bookmarks[i + 1];
                const duration = Math.max(1, this.calculateDuration(startBookmark.time, endBookmark.time));
                const pairIndex = Math.floor(i / 2) + 1;

                console.log(`\\n=== Processing Pair ${pairIndex} ===`);
                console.log(`Start: ${startBookmark.time} -> End: ${endBookmark.time} (${duration}s)`);

                // Generate filename with start time in 小时-分钟-秒 format
                const fileBaseName = path.basename(videoPath, path.extname(videoPath));
                const formattedStartTime = this.formatTimeForFilename(startBookmark.time);
                const outputFileName = `${fileBaseName}_${formattedStartTime}.gif`;
                const outputPath = path.join(this.outputDir, outputFileName);

                console.log(`\u2701 \u8f93\u8f93: ${outputPath}`);

                try {
                    // Simplified one-step FFmpeg for GIF generation (more reliable)
                    console.log(`\u2701 Generating GIF directly...`);

                    const gifResult = await this.executeFFmpeg([
                        '-y',
                        '-ss', startBookmark.time.split('.')[0],
                        '-t', duration.toString(),
                        '-i', videoPath,
                        '-vf', `fps=${this.defaultFps},scale=${this.defaultWidth}:${this.defaultHeight}:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
                        outputPath
                    ]);

                    if (gifResult !== 0) {
                        console.log(`\u2701 \u2702 GIF generation failed`);
                        throw new Error('Failed to generate GIF');
                    }

                    // Check if file was created
                    const success = fs.existsSync(outputPath);
                    const stats = success ? fs.statSync(outputPath) : null;
                    const fileSize = stats ? Math.round(stats.size / 1024) : 0;

                    // Send progress update
                    if (event) {
                        event.sender.send('processing-progress', {
                            current: processedCount + 1,
                            total: Math.floor(bookmarks.length / 2),
                            message: `\u5904\u7406\u7406 Pair ${pairIndex}: ${startBookmark.name}`
                        });
                    }

                    results.push({
                        pairIndex: pairIndex,
                        globalPairIndex: processedCount + 1,
                        startTime: startBookmark.time,
                        endTime: endBookmark.time,
                        duration: duration,
                        name: startBookmark.name || `\u7247\u7247 Pair ${pairIndex}`,
                        success: success,
                        outputPath: outputPath,
                        actualFileCreated: success,
                        fileSize: fileSize
                    });

                    if (success) {
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
                        name: startBookmark.name || `\u7247\u7247 Pair ${pairIndex}`,
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
                            message: `\u9519\u9519 Error in Pair ${pairIndex}: ${error.message}`
                        });
                    }

                    processedCount++;
                }
            }

            // Send final progress
            if (event) {
                event.sender.send('processing-progress', {
                    current: processedCount,
                    total: processedCount,
                    message: '\u5904\u7406\u7406 Processing completed!'
                });
            }

            console.log(`\\n=== Processing Complete ===`);
            console.log(`Total pairs: ${Math.floor(bookmarks.length / 2)}`);
            console.log(`Successful: ${results.filter(r => r.success).length}`);
            console.log(`Failed: ${results.filter(r => !r.success).length}`);

            return {
                success: true,
                message: `\u5904\u7406\u7406 Processed ${Math.floor(bookmarks.length / 2)} bookmark pairs`,
                results: results
            };

        } catch (error) {
            console.error('\u2701 \u2702 Processing failed:', error.message);
            return {
                success: false,
                message: `\u5904\u7406\u7406 Processing failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async executeFFmpeg(args) {
        return new Promise((resolve, reject) => {
            const process = spawn('ffmpeg', args);

            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0) {
                    resolve(code);
                } else {
                    console.error(`FFmpeg failed with exit code ${code}`);
                    console.error(`stderr: ${stderr}`);
                    reject(new Error(`FFmpeg failed with exit code ${code}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`FFmpeg spawn error: ${error.message}`));
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
}

module.exports = UltimateWorkingProcessor;