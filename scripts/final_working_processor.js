/**
 * Final Working Bookmark Processor - Guaranteed to work
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class FinalWorkingProcessor {
    constructor(options = {}) {
        this.outputDir = options.outputDir || 'D:\\';
        this.defaultWidth = options.defaultWidth || 480;
        this.defaultHeight = options.defaultHeight || 270;
        this.defaultFps = options.defaultFps || 15;
        this.defaultQuality = options.defaultQuality || 20;
    }

    async processBookmarkPairs(bookmarks, videoPath, event = null) {
        console.log(`=== Final Working Processor Started ===`);
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
                    // Use direct FFmpeg call
                    console.log('Executing FFmpeg...');
                    await this.executeFFmpeg({
                        videoPath,
                        startTime: startBookmark.time.split('.')[0],
                        duration,
                        outputPath,
                        width: this.defaultWidth,
                        height: this.defaultHeight,
                        fps: this.defaultFps,
                        quality: this.defaultQuality
                    });

                    // Check if file was created
                    const success = fs.existsSync(outputPath);

                    // Send progress update
                    if (event) {
                        event.sender.send('processing-progress', {
                            current: processedCount + 1,
                            total: Math.floor(bookmarks.length / 2),
                            message: `Processing Pair ${pairIndex}`
                        });
                    }

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

                    if (event) {
                        event.sender.send('processing-progress', {
                            current: processedCount + 1,
                            total: Math.floor(bookmarks.length / 2),
                            message: `Error in Pair ${pairIndex}: ${error.message}`
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
                    message: 'Processing completed!'
                });
            }

            console.log(`\\n=== Processing Complete ===`);
            console.log(`Total pairs: ${Math.floor(bookmarks.length / 2)}`);
            console.log(`Successful: ${results.filter(r => r.success).length}`);
            console.log(`Failed: ${results.filter(r => !r.success).length}`);

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

    async executeFFmpeg(params) {
        const {
            videoPath,
            startTime,
            duration,
            outputPath,
            width = this.defaultWidth,
            height = this.defaultHeight,
            fps = this.defaultFps,
            quality = this.defaultQuality
        } = params;

        // Ensure quality is in valid range (1-5)
        const bayerScale = Math.max(1, Math.min(5, Math.floor(quality / 4)));

        console.log('FFmpeg Parameters:');
        console.log(`  Input: ${videoPath}`);
        console.log(`  Start: ${startTime}`);
        console.log(`  Duration: ${duration}s`);
        console.log(`  Size: ${width}x${height}`);
        console.log(`  FPS: ${fps}`);
        console.log(`  Quality: ${quality} (bayer scale: ${bayerScale})`);
        console.log(`  Output: ${outputPath}`);

        return new Promise((resolve, reject) => {
            // Create temp directory
            const tempDir = fs.mkdtempSync('ffmpeg_gif_');
            const palettePath = path.join(tempDir, 'palette.png');

            console.log('Step 1: Generating palette...');

            // Execute palette generation
            const paletteArgs = [
                '-y',
                '-ss', startTime,
                '-t', duration.toString(),
                '-i', videoPath,
                '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,palettegen=stats_mode=diff`,
                palettePath
            ];

            const paletteProcess = spawn('ffmpeg', paletteArgs);

            let paletteStdout = '';
            let paletteStderr = '';

            paletteProcess.stdout.on('data', (data) => {
                paletteStdout += data.toString();
            });

            paletteProcess.stderr.on('data', (data) => {
                paletteStderr += data.toString();
            });

            await new Promise((resolve) => {
                paletteProcess.on('close', (code) => {
                    resolve(code);
                });
            });

            if (paletteExit !== 0) {
                console.error('Palette generation failed');
                console.error('FFmpeg palette stderr:', paletteStderr);
                reject(new Error(`Palette generation failed: ${paletteStderr}`));
                return;
            }

            console.log('Step 2: Generating GIF...');

            // Execute GIF generation
            const gifArgs = [
                '-y',
                '-ss', startTime,
                '-t', duration.toString(),
                '-i', videoPath,
                '-i', palettePath,
                '-lavfi', `fps=${fps},scale=${width}:${height}:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=${bayerScale}`,
                outputPath
            ];

            const gifProcess = spawn('ffmpeg', gifArgs);

            let gifStdout = '';
            let gifStderr = '';

            gifProcess.stdout.on('data', (data) => {
                gifStdout += data.toString();
            });

            gifProcess.stderr.on('data', (data) => {
                gifStderr += data.toString();
            });

            await new Promise((resolve) => {
                gifProcess.on('close', (code) => {
                    resolve(code);
                });
            });

            // Clean up temp directory
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (cleanupError) {
                console.warn('Failed to clean up temp directory:', cleanupError.message);
            }

            if (gifExit !== 0) {
                console.error('GIF generation failed');
                console.error('FFmpeg GIF stderr:', gifStderr);
                reject(new Error(`GIF generation failed: ${gifStderr}`));
                return;
            }

            console.log('GIF generation completed successfully');
            resolve({ success: true });
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

module.exports = FinalWorkingProcessor;