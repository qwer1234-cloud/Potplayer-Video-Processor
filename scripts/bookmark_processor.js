/**
 * Bookmark Processor - High-level interface for processing bookmarks with FFmpeg
 */

const BookmarkScriptGenerator = require('./generate_bookmark_scripts');
const path = require('path');
const fs = require('fs');

class BookmarkProcessor {
    constructor(options = {}) {
        this.generator = new BookmarkScriptGenerator(options);
        this.outputDir = options.outputDir || 'D:\\';
    }

    /**
     * Process multiple PBF files and generate FFmpeg scripts
     */
    async processMultiplePBFFiles(pbfFiles, allBookmarks, options = {}) {
        console.log(`Processing ${pbfFiles.length} PBF files with ${allBookmarks.length} bookmark sets`);
        console.log(`PBF files: ${JSON.stringify(pbfFiles, null, 2)}`);
        console.log(`Options: ${JSON.stringify(options, null, 2)}`);

        try {
            // Find video files for each PBF
            const videoPaths = [];
            for (const pbfPath of pbfFiles) {
                try {
                    console.log(`Looking for video file for: ${pbfPath}`);
                    const videoPath = await this.findVideoFileForPBF(pbfPath);
                    console.log(`Found video: ${videoPath}`);
                    videoPaths.push(videoPath);
                } catch (error) {
                    console.error(`No video found for ${pbfPath}: ${error.message}`);
                    videoPaths.push(null);
                }
            }

            // Generate master script
            const bookmarkData = {
                pbfFiles,
                allBookmarks,
                videoPaths
            };

            const result = this.generator.generateMasterScript(bookmarkData, options);

            // Clean up old scripts
            this.generator.cleanupOldScripts();

            console.log(`Generated master script: ${result.masterScriptPath}`);
            console.log(`Total bookmark pairs to process: ${result.totalScripts}`);

            return {
                success: true,
                masterScriptPath: result.masterScriptPath,
                scriptDir: result.scriptDir,
                totalScripts: result.totalScripts,
                videoPaths,
                message: `成功生成脚本，可处理 ${result.totalScripts} 个书签对`
            };

        } catch (error) {
            console.error('Failed to process multiple PBF files:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process single PBF file and generate FFmpeg scripts
     */
    async processSinglePBFFile(pbfPath, bookmarks, options = {}) {
        console.log(`Processing single PBF file with ${bookmarks.length} bookmarks`);

        try {
            // Find video file
            const videoPath = await this.findVideoFileForPBF(pbfPath);

            // Generate individual scripts for each bookmark pair
            const scripts = [];
            const fileName = path.basename(pbfPath, '.pbf');

            for (let i = 0; i < bookmarks.length - 1; i += 2) {
                const startBookmark = bookmarks[i];
                const endBookmark = bookmarks[i + 1];

                const duration = this.calculateDuration(startBookmark.time, endBookmark.time);
                const pairIndex = Math.floor(i / 2) + 1;

                const bookmarkPair = {
                    start: startBookmark,
                    end: endBookmark,
                    duration,
                    fileName,
                    pairIndex,
                    globalPairIndex: i / 2 + 1
                };

                const scriptResult = this.generator.generateSingleBookmarkScript(
                    bookmarkPair, videoPath, options
                );
                scripts.push(scriptResult);
            }

            // Generate master script to run all individual scripts
            const masterScriptPath = this.generateSimpleMasterScript(scripts, fileName);

            // Clean up old scripts
            this.generator.cleanupOldScripts();

            console.log(`Generated ${scripts.length} individual scripts and master script: ${masterScriptPath}`);
            console.log(`Individual scripts output paths:`);
            scripts.forEach((script, index) => {
                console.log(`  ${index + 1}: ${script.outputPath}`);
            });

            return {
                success: true,
                masterScriptPath,
                scripts,
                videoPath,
                totalScripts: scripts.length,
                message: `成功生成 ${scripts.length} 个脚本`
            };

        } catch (error) {
            console.error('Failed to process single PBF file:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Execute generated scripts
     */
    async executeScripts(masterScriptPath) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            const path = require('path');

            console.log(`Executing master script: ${masterScriptPath}`);
            console.log(`Working directory: ${path.dirname(masterScriptPath)}`);
            console.log(`Script exists: ${require('fs').existsSync(masterScriptPath)}`);

            // Check if FFmpeg is available
            exec('where ffmpeg', (error, stdout, stderr) => {
                if (error) {
                    console.error('FFmpeg not found:', error.message);
                    reject(new Error('FFmpeg is not installed or not in PATH. Please install FFmpeg and add it to your PATH.'));
                    return;
                } else {
                    console.log('FFmpeg found at:', stdout.trim());
                }

                // Execute the master script
                exec(`cmd /c "${masterScriptPath}"`, {
                    cwd: path.dirname(masterScriptPath),
                    timeout: 1800000, // 30 minutes timeout
                    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                    stdio: ['pipe', 'pipe', 'pipe'] // Capture all output streams
                }, (error, stdout, stderr) => {
                    console.log('=== Script Execution Output ===');
                    console.log('STDOUT length:', stdout ? stdout.length : 0);
                    console.log('STDERR length:', stderr ? stderr.length : 0);

                    // Show first few lines of output for debugging
                    if (stdout) {
                        const stdoutLines = stdout.split('\n').slice(0, 10);
                        console.log('STDOUT (first 10 lines):');
                        stdoutLines.forEach((line, i) => console.log(`${i+1}: ${line}`));
                    }

                    if (stderr) {
                        const stderrLines = stderr.split('\n').slice(0, 10);
                        console.log('STDERR (first 10 lines):');
                        stderrLines.forEach((line, i) => console.log(`${i+1}: ${line}`));
                    }

                    console.log('=== End Output ===');

                    if (error) {
                        console.error('Script execution failed:', error);
                        console.error('Error code:', error.code);
                        console.error('Error signal:', error.signal);
                        reject(new Error(`Script execution failed: ${error.message}`));
                    } else {
                        console.log('Script execution completed successfully');

                        // Count actual GIF files created
                        const outputDir = this.outputDir || 'D:\\';
                        const fs = require('fs');
                        let gifCount = 0;

                        try {
                            const files = fs.readdirSync(outputDir);
                            gifCount = files.filter(file => file.toLowerCase().endsWith('.gif')).length;
                            console.log(`Found ${gifCount} GIF files in output directory: ${outputDir}`);
                        } catch (dirError) {
                            console.warn('Could not check output directory:', dirError.message);
                        }

                        resolve({
                            success: true,
                            stdout,
                            stderr,
                            gifCount,
                            outputDir
                        });
                    }
                });
            });
        });
    }

    /**
     * Find corresponding video file for PBF file
     */
    async findVideoFileForPBF(pbfFilePath) {
        const pbfDir = path.dirname(pbfFilePath);
        const pbfBaseName = path.basename(pbfFilePath, '.pbf');

        // Common video extensions to try
        const videoExtensions = ['mp4', 'avi', 'mov', 'mkv', 'wmv', 'flv', 'webm'];

        // Try same base name with different extensions
        for (const ext of videoExtensions) {
            const videoPath = path.join(pbfDir, `${pbfBaseName}.${ext}`);
            if (fs.existsSync(videoPath)) {
                console.log(`Found corresponding video file: ${videoPath}`);
                return videoPath;
            }
        }

        throw new Error(`未找到对应的视频文件，请确保视频文件与PBF文件同名（扩展名不同）`);
    }

    /**
     * Calculate duration between two time strings
     */
    calculateDuration(startTime, endTime) {
        return this.generator.calculateDuration(startTime, endTime);
    }

    /**
     * Generate simple master script to run all individual scripts
     */
    generateSimpleMasterScript(scripts, fileName) {
        const timestamp = Date.now();
        const masterScriptPath = path.join(this.generator.scriptDir, `master_${fileName}_${timestamp}.bat`);

        let content = '@echo off\n';
        content += 'setlocal enabledelayedexpansion\n\n';
        content += `:: Master script for ${fileName}\n`;
        content += `:: Generated on: ${new Date().toISOString()}\n\n`;

        content += 'echo Starting GIF generation from bookmarks...\n';
        content += 'echo.\n\n';

        content += 'set successCount=0\n';
        content += 'set totalCount=' + scripts.length + '\n\n';

        scripts.forEach((script, index) => {
            content += `echo Processing script ${index + 1}/${scripts.length}: ${path.basename(script.scriptPath)}\n`;
            content += `call "${script.scriptPath}"\n`;
            content += `if !ERRORLEVEL! equ 0 (\n`;
            content += `    echo SUCCESS: ${script.outputName}\n`;
            content += `    set /a successCount+=1\n`;
            content += `) else (\n`;
            content += `    echo ERROR: Failed to process ${script.outputName}\n`;
            content += `)\n`;
            content += `echo.\n`;
        });

        content += 'echo =======================================\n';
        content += 'echo Batch processing completed!\n';
        content += 'echo Total: !totalCount!\n';
        content += 'echo Successful: !successCount!\n';
        content += 'echo Failed: !totalCount! - !successCount!\n';
        content += 'echo =======================================\n\n';
        content += 'pause\n';

        fs.writeFileSync(masterScriptPath, content, 'utf8'); // No BOM for proper batch file execution
        return masterScriptPath;
    }
}

module.exports = BookmarkProcessor;