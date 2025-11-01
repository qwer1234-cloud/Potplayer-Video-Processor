/**
 * Debug PBF Processor - 专门用于诊断PBF文件路径问题
 */

const fs = require('fs');
const path = require('path');

class DebugPBFProcessor {
    constructor() {
        this.debug = true;
    }

    async processMultiplePBFFiles(pbfFiles, allBookmarksData) {
        console.log('\n=== Debug PBF Processor Started ===');
        console.log('\u2701 PBF Files:', pbfFiles.length);
        console.log('\u2701 All Bookmarks Data:', allBookmarksData.length);

        // 诊断PBF文件路径问题
        console.log('\n=== Diagnosing PBF file path issues ===');

        let results = [];

        for (let i = 0; i < pbfFiles.length; i++) {
            const pbfPath = pbfFiles[i];
            console.log(`\nProcessing PBF file ${i + 1}/${pbfFiles.length}: ${pbfPath}`);

            // 1. 检查PBF文件是否存在
            const pbfExists = fs.existsSync(pbfPath);
            console.log(`  ✅ PBF file exists: ${pbfExists}`);

            if (!pbfExists) {
                results.push({
                    fileIndex: i,
                    filePath: pbfPath,
                    success: false,
                    error: 'PBF文件不存在',
                    debug: {
                        pbfExists: false,
                        videoPathChecked: false
                    }
                });
                continue;
            }

            // 2. 检查对应视频文件
            const pbfDir = path.dirname(pbfPath);
            const pbfBaseName = path.basename(pbfPath, '.pbf');
            const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.wmv', '.flv', '.webm'];

            let videoPath = null;
            for (const ext of videoExtensions) {
                const testVideoPath = path.join(pbfDir, `${pbfBaseName}${ext}`);
                if (fs.existsSync(testVideoPath)) {
                    videoPath = testVideoPath;
                    console.log(`  ✅ Found video file: ${testVideoPath}`);
                    break;
                }
            }

            console.log(`  🔍 Video path found: ${videoPath}`);

            // 3. 检查视频文件是否可读
            let videoReadable = false;
            try {
                fs.accessSync(videoPath, fs.constants.R_OK);
                videoReadable = true;
                console.log(`  ✅ Video file is readable: ${videoPath}`);
            } catch (error) {
                console.log(`  ❌ Video file is not readable: ${error.message}`);
            }

            // 4. 测试PBF文件读取
            let pbfContent = '';
            try {
                const buffer = fs.readFileSync(pbfPath);
                pbfContent = buffer.toString('utf16le');
                console.log(`  ✅ PBF file read successfully, size: ${buffer.length} bytes`);
            } catch (error) {
                console.log(`  ❌ Failed to read PBF file: ${error.message}`);
                results.push({
                    fileIndex: i,
                    filePath: pbfPath,
                    success: false,
                    error: `PBF文件读取失败: ${error.message}`,
                    debug: {
                        pbfExists: true,
                        videoPathChecked: true,
                        videoReadable: videoReadable,
                        pbfReadError: error.message
                    }
                });
                continue;
            }

            // 5. 解析PBF内容
            const bookmarks = this.parsePBFContent(pbfContent, pbfPath);
            console.log(`  ✅ PBF parsed successfully, bookmarks found: ${bookmarks.length}`);

            // 6. 生成处理结果
            const bookmarkPairs = [];
            for (let j = 0; j < bookmarks.length - 1; j += 2) {
                const startBookmark = bookmarks[j];
                const endBookmark = bookmarks[j + 1];

                const duration = this.calculateDuration(startBookmark.time, endBookmark.time);
                const pairIndex = Math.floor(j / 2) + 1;

                bookmarkPairs.push({
                    start: startBookmark,
                    end: endBookmark,
                    duration: duration,
                    pairIndex: pairIndex,
                    globalPairIndex: results.length + 1
                });
            }

            if (bookmarkPairs.length > 0) {
                console.log(`  ✅ Created ${bookmarkPairs.length} bookmark pairs for processing`);

                // 模拟生成文件路径（仅用于测试）
                for (let k = 0; k < bookmarkPairs.length; k++) {
                    const pair = bookmarkPairs[k];
                    const fileBaseName = path.basename(videoPath, path.extname(videoPath));
                    const startTimeStr = pair.start.time.split('.')[0];
                    const startTimeFormatted = startTimeStr.replace(/:/g, '');
                    const outputFileName = `${fileBaseName}_${startTimeFormatted}_debug_${i + 1}.gif`;
                    const outputPath = path.join('D:\\', outputFileName);

                    console.log(`  📝 Would generate: ${outputPath}`);
                    console.log(`     Pair ${pair.globalPairIndex}: ${pair.start.time} -> ${pair.end.time} (${pair.duration}s)`);
                }
            }

            results.push({
                fileIndex: i,
                filePath: pbfPath,
                videoPath: videoPath,
                bookmarks: bookmarks,
                bookmarkPairs: bookmarkPairs,
                success: true,
                debug: {
                    pbfExists: true,
                    videoPathChecked: true,
                    videoReadable: videoReadable,
                    pbfReadSuccess: true,
                    bookmarkCount: bookmarks.length,
                    pairCount: bookmarkPairs.length
                }
            });

        }

        // 生成诊断报告
        console.log('\n=== DIAGNOSTIC REPORT ===');
        const totalFiles = pbfFiles.length;
        const totalBookmarks = allBookmarksData.reduce((sum, item) => sum + item.bookmarks.length, 0);
        const successfulFiles = results.filter(r => r.success).length;
        const totalPairs = results.reduce((sum, item) => sum + (item.bookmarkPairs ? item.bookmarkPairs.length : 0), 0);

        console.log(`\u2701 SUMMARY:`);
        console.log(`  Total PBF files: ${totalFiles}`);
        console.log(`  Successful files: ${successfulFiles}`);
        console.log(`  Total bookmarks: ${totalBookmarks}`);
        console.log(`  Total pairs: ${totalPairs}`);

        return results;
    }

    parsePBFContent(content, filePath) {
        console.log(`  🔍 Parsing PBF content from: ${filePath}`);

        const bookmarks = [];
        const lines = content.split('\n');

        // 尝试多种PBF格式
        let bookmarksFound = false;

        // 格式1: PotPlayer PBF格式 (序号=时间戳*书签名称*图片数据...)
        // 注意：不能使用全局标志，否则会陷入无限循环
        const potPlayerRegex = /^(\d+)=(\d+)\*([^*]*)\*/;

        // 查找所有匹配行
        for (let lineRaw of lines) {
            const line = lineRaw.trim();
            if (line.startsWith('//') || line === '' || line === '[Bookmark]') continue;

            const match = potPlayerRegex.exec(line);
            if (match) {
                const index = parseInt(match[1]);
                const timestamp = parseInt(match[2]);
                const bookmarkName = match[3] || `书签 ${index + 1}`;

                console.log(`  🔍 Found bookmark: Index=${index}, Timestamp=${timestamp}, Name="${bookmarkName}"`);

                // 转换时间戳
                const timeString = this.convertTimestampToTime(timestamp);

                bookmarks.push({
                    index: index,
                    timestamp: timestamp,
                    time: timeString,
                    name: bookmarkName
                });

                bookmarksFound = true;
            }
        }

  
        console.log(`  ✅ Found ${bookmarks.length} bookmarks in PBF format`);

        if (!bookmarksFound) {
            console.log('  ❌ No bookmarks found in PBF format');
        }

        // 如果没有找到，尝试其他格式...
        if (!bookmarksFound && lines.length > 0) {
            // 尝试简单时间格式
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('//') || line === '') continue;

                const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?/);
                if (timeMatch) {
                    const hours = timeMatch[1] || '00';
                    const minutes = timeMatch[2] || '00';
                    const seconds = timeMatch[3] || '00';
                    const milliseconds = timeMatch[4] || '000';

                    const timeStr = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}.${milliseconds.padStart(3, '0')}`;

                    bookmarks.push({
                        index: bookmarks.length + 1,
                        timestamp: null,
                        time: timeStr,
                        name: `书签 ${bookmarks.length + 1}`
                    });

                    console.log(`  ✅ Found time-based bookmark: ${timeStr}`);
                }
            }
        }

        return bookmarks;
    }

    convertTimestampToTime(timestamp) {
        const totalSeconds = Math.floor(timestamp / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = timestamp % 1000;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
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

module.exports = DebugPBFProcessor;