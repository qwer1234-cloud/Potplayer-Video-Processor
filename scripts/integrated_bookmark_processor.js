/**
 * Integrated Bookmark Processor - Combines parsing and direct FFmpeg processing
 */

const DirectFFmpegProcessor = require('./direct_ffmpeg_processor');
const fs = require('fs');

class IntegratedBookmarkProcessor {
    constructor(options = {}) {
        this.outputDir = options.outputDir || 'D:\\';
        this.defaultWidth = options.defaultWidth || 480;
        this.defaultHeight = options.defaultHeight || 270;
        this.defaultFps = options.defaultFps || 15;
        this.defaultQuality = options.defaultQuality || 20;
    }

    async processMultiplePBFFiles(pbfFiles, allBookmarksData, event = null) {
        console.log(`=== Integrated FFmpeg Processing Started ===`);
        console.log(`Processing ${pbfFiles.length} PBF files`);

        const results = [];
        let processedCount = 0;

        try {
            // Process each PBF file
            for (let fileIndex = 0; fileIndex < allBookmarksData.length; fileIndex++) {
                const pbfData = allBookmarksData[fileIndex];
                const { fileName, bookmarks } = pbfData;

                // Find corresponding video file
                const videoPath = await this.findVideoFileForPBF(pbfFiles[fileIndex]);
                if (!videoPath) {
                    console.warn(`No video found for ${fileName}, skipping...`);
                    continue;
                }

                console.log(`\\nProcessing ${fileName}: Found video at ${videoPath}`);
                console.log(`Found ${bookmarks.length} bookmarks`);

                // Process bookmark pairs
                for (let i = 0; i < bookmarks.length - 1; i += 2) {
                    const startBookmark = bookmarks[i];
                    const endBookmark = bookmarks[i + 1];
                    const duration = this.calculateDuration(startBookmark.time, endBookmark.time);
                    const pairIndex = Math.floor(i / 2) + 1;

                    console.log(`\\n--- Processing pair ${pairIndex}: ${startBookmark.name} -> ${endBookmark.name} (${duration}s) ---`);

                    const bookmarkPair = {
                        start: startBookmark,
                        end: endBookmark,
                        duration,
                        fileName,
                        pairIndex,
                        globalPairIndex: processedCount + 1
                    };

                    try {
                        const processor = new DirectFFmpegProcessor({
                            outputDir: this.outputDir,
                            width: this.defaultWidth,
                            height: this.defaultHeight,
                            fps: this.defaultFps,
                            quality: this.defaultQuality
                        });

                        const result = await processor.processBookmarkPair(bookmarkPair, videoPath);

                        // Send progress update if event provided
                        if (event) {
                            event.sender.send('processing-progress', {
                                current: processedCount + 1,
                                total: Math.floor(bookmarks.length / 2),
                                message: `处理 ${fileName} - ${startBookmark.name} (${duration}s)`
                            });
                        }

                        results.push({
                            fileName: fileName,
                            pairIndex: pairIndex,
                            globalPairIndex: processedCount + 1,
                            startTime: startBookmark.time,
                            endTime: endBookmark.time,
                            duration: duration,
                            name: startBookmark.name || `片段 ${pairIndex}`,
                            success: result.success,
                            outputPath: result.outputPath,
                            actualFileCreated: result.success,
                            fileSize: result.fileSize
                        });

                        if (result.success) {
                            console.log(`✅ SUCCESS: ${result.outputPath}`);
                        } else {
                            console.log(`❌ FAILED: ${result.error || 'Unknown error'}`);
                        }

                        processedCount++;

                    } catch (error) {
                        console.error(`Error processing pair ${pairIndex}:`, error.message);
                        results.push({
                            fileName: fileName,
                            pairIndex: pairIndex,
                            globalPairIndex: processedCount + 1,
                            startTime: startBookmark.time,
                            endTime: endBookmark.time,
                            duration: duration,
                            name: startBookmark.name || `片段 ${pairIndex}`,
                            success: false,
                            outputPath: null,
                            actualFileCreated: false,
                            error: error.message
                        });
                        processedCount++;
                    }
                }
            }

            // Send final progress update
            if (event) {
                event.sender.send('processing-progress', {
                    current: processedCount,
                    total: processedCount,
                    message: '处理完成！'
                });
            }

            console.log(`\\n=== Processing Completed ===`);
            console.log(`Total processed: ${processedCount}`);
            console.log(`Successful: ${results.filter(r => r.success).length}`);
            console.log(`Failed: ${results.filter(r => !r.success).length}`);

            return {
                success: true,
                message: `成功处理 ${processedCount} 个书签对`,
                results: results
            };

        } catch (error) {
            console.error('Processing failed:', error.message);
            return {
                success: false,
                message: `处理失败: ${error.message}`,
                error: error.message
            };
        }
    }

    async findVideoFileForPBF(pbfPath) {
        const pbfDir = require('path').dirname(pbfPath);
        const pbfBaseName = require('path').basename(pbfPath, '.pbf');
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];

        for (const ext of videoExtensions) {
            const videoPath = require('path').join(pbfDir, `${pbfBaseName}.${ext}`);
            if (fs.existsSync(videoPath)) {
                return videoPath;
            }
        }

        throw new Error(`未找到对应的视频文件，请确保视频文件与PBF文件同名（扩展名不同）`);
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
        const duration = Math.max(1, Math.round(endSeconds - startSeconds));

        return duration;
    }
}

module.exports = IntegratedBookmarkProcessor;

// Also export for direct access
global.IntegratedBookmarkProcessor = IntegratedBookmarkProcessor;