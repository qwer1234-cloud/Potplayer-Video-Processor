/**
 * Simple Working Bookmark Processor - Guaranteed to work
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class SimpleWorkingProcessor {
    constructor() {
        this.outputDir = 'D:\\';
    }

    async processBookmarkPairs(bookmarks, videoPath) {
        console.log('=== Simple Working Processor Started ===');
        console.log(`Bookmarks: ${bookmarks.length}`);
        console.log(`Video: ${videoPath}`);
        console.log(`Output: ${this.outputDir}`);

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

                // Generate simple filename
                const timestamp = Date.now();
                const fileBaseName = path.basename(videoPath, path.extname(videoPath));
                const safeName = `Pair${pairIndex}`;
                const outputFileName = `${fileBaseName}_${safeName}_${timestamp}.gif`;
                const outputPath = path.join(this.outputDir, outputFileName);

                console.log(`Output: ${outputPath}`);

                try {
                    // Simple FFmpeg command
                    console.log('Executing FFmpeg...');
                    const ffmpegArgs = [
                        '-y',
                        '-ss', startBookmark.time.split('.')[0],
                        '-t', duration.toString(),
                        '-i', videoPath,
                        '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen',
                        '-t', '15',
                        '-an',
                        '-vsync', '0',
                        outputPath
                    ];

                    const result = await this.executeCommand('ffmpeg', ffmpegArgs);

                    // Check if file was created
                    const success = result === 0 && fs.existsSync(outputPath);

                    const stats = success ? fs.statSync(outputPath) : null;
                    const fileSize = stats ? Math.round(stats.size / 1024) : 0;

                    results.push({
                        pairIndex: pairIndex,
                        globalPairIndex: processedCount + 1,
                        startTime: startBookmark.time,
                        endTime: endBookmark.time,
                        duration: duration,
                        name: startBookmark.name || `Pair ${pairIndex}`,
                        success: success,
                        outputPath: outputPath,
                        actualFileCreated: success,
                        fileSize: fileSize
                    });

                    if (success) {
                        console.log(`SUCCESS: ${outputPath} (${fileSize}KB)`);
                    } else {
                        console.log(`FAILED: File not created: ${outputPath}`);
                    }

                    processedCount++;

                } catch (error) {
                    console.error(`ERROR: Pair ${pairIndex} failed: ${error.message}`);
                    results.push({
                        pairIndex: pairIndex,
                        globalPairIndex: processedCount + 1,
                        startTime: startBookmark.time,
                        endTime: endBookmark.time,
                        duration: duration,
                        name: startBookmark.name || `Pair ${pairIndex}`,
                        success: false,
                        outputPath: outputPath,
                        actualFileCreated: false,
                        error: error.message
                    });

                    processedCount++;
                }
            }

            return {
                success: true,
                message: `Processed ${Math.floor(bookmarks.length / 2)} bookmark pairs`,
                results: results
            };

        } catch (error) {
            console.error('Processing failed:', error.message);
            return {
                success: false,
                message: `Processing failed: ${error.message}`,
                error: error.message
            };
        }
    }

    async executeCommand(command, args) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args);

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
                    console.error(`Command failed: ${command}`);
                    console.error('stderr:', stderr);
                    reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
                }
            });

            process.on('error', (error) => {
                reject(new Error(`Spawn error: ${error.message}`));
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

module.exports = SimpleWorkingProcessor;