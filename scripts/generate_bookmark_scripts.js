/**
 * FFmpeg Bookmark Script Generator
 *
 * This module generates FFmpeg-based scripts for creating GIFs from bookmark pairs
 */

const fs = require('fs');
const path = require('path');

class BookmarkScriptGenerator {
    constructor(options = {}) {
        this.outputDir = options.outputDir || 'D:\\';
        // Fix the scriptDir path to avoid nested directories
        this.scriptDir = options.scriptDir || path.resolve(__dirname, 'generated_scripts');
        this.defaultWidth = options.defaultWidth || 480;
        this.defaultHeight = options.defaultHeight || 270;
        this.defaultFps = options.defaultFps || 15;
        this.defaultQuality = options.defaultQuality || 20;

        // Ensure script directory exists
        this.ensureDirectoryExists(this.scriptDir);
        console.log(`Script directory: ${this.scriptDir}`);
        console.log(`Output directory: ${this.outputDir}`);
    }

    /**
     * Ensure directory exists
     */
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Generate a batch script for a single bookmark pair
     */
    generateSingleBookmarkScript(bookmarkPair, videoPath, options = {}) {
        const {
            start,
            end,
            duration,
            fileName,
            pairIndex,
            globalPairIndex
        } = bookmarkPair;

        const width = options.width || this.defaultWidth;
        const height = options.height || this.defaultHeight;
        const fps = options.fps || this.defaultFps;
        const quality = options.quality || this.defaultQuality;

        // Generate output filename
        const outputName = this.generateOutputFileName(fileName, start, pairIndex, globalPairIndex);
        const outputPath = path.join(this.outputDir, outputName);

        // Generate script content
        const scriptContent = this.generateScriptContent({
            videoPath,
            startTime: start.time,
            duration,
            outputPath,
            width,
            height,
            fps,
            quality,
            bookmarkName: start.name || `片段 ${pairIndex}`
        });

        // Save script to file
        const scriptFileName = `bookmark_${fileName.replace(/[^\w]/g, '_')}_${pairIndex}.bat`;
        const scriptPath = path.join(this.scriptDir, scriptFileName);

        fs.writeFileSync(scriptPath, scriptContent, 'utf8'); // No BOM - Windows handles UTF-8 fine for batch files

        return {
            scriptPath,
            outputPath,
            scriptFileName,
            outputName
        };
    }

    /**
     * Generate a master batch script for processing multiple bookmark pairs
     */
    generateMasterScript(bookmarkData, options = {}) {
        const { pbfFiles, allBookmarks, videoPaths } = bookmarkData;
        const masterScriptPath = path.join(this.scriptDir, `master_${Date.now()}.bat`);

        let scriptContent = '@echo off\n';
        scriptContent += 'setlocal enabledelayedexpansion\n\n';
        scriptContent += ':: Master Script for Batch Bookmark GIF Generation\n';
        scriptContent += ':: Generated on: ' + new Date().toISOString() + '\n\n';

        scriptContent += 'echo Starting batch GIF generation from bookmarks...\n';
        scriptContent += 'echo.\n\n';

        let totalScripts = 0;
        let successCount = 0;

        // Process each PBF file's bookmarks
        for (let fileIndex = 0; fileIndex < allBookmarks.length; fileIndex++) {
            const pbfData = allBookmarks[fileIndex];
            const { fileName, bookmarks } = pbfData;
            const videoPath = videoPaths && videoPaths[fileIndex];

            if (!videoPath) {
                scriptContent += `echo WARNING: No video path found for ${fileName}, skipping...\n\n`;
                continue;
            }

            scriptContent += `echo Processing ${fileName}...\n`;

            // Create bookmark pairs
            for (let i = 0; i < bookmarks.length - 1; i += 2) {
                const startBookmark = bookmarks[i];
                const endBookmark = bookmarks[i + 1];

                const duration = this.calculateDuration(startBookmark.time, endBookmark.time);
                const pairIndex = Math.floor(i / 2) + 1;

                // Generate individual script
                const bookmarkPair = {
                    start: startBookmark,
                    end: endBookmark,
                    duration,
                    fileName,
                    pairIndex,
                    globalPairIndex: totalScripts + 1
                };

                const scriptResult = this.generateSingleBookmarkScript(bookmarkPair, videoPath, options);

                // Add to master script
                scriptContent += `echo.\n`;
                scriptContent += `echo Processing ${fileName} - Pair ${pairIndex}: ${startBookmark.name || `片段 ${pairIndex}`}...\n`;
                scriptContent += `call "${scriptResult.scriptPath}"\n`;
                scriptContent += `if !ERRORLEVEL! equ 0 (\n`;
                scriptContent += `    echo SUCCESS: ${scriptResult.outputName}\n`;
                scriptContent += `    set /a successCount+=1\n`;
                scriptContent += `) else (\n`;
                scriptContent += `    echo ERROR: Failed to process ${fileName} - Pair ${pairIndex}\n`;
                scriptContent += `)\n`;

                totalScripts++;
            }
        }

        // Add summary section
        scriptContent += `\necho.\necho =======================================\n`;
        scriptContent += `echo Batch processing completed!\n`;
        scriptContent += `echo Total files processed: ${totalScripts}\n`;
        scriptContent += `echo Successful: !successCount!\n`;
        scriptContent += `echo Failed: ${totalScripts} - !successCount!\n`;
        scriptContent += `echo =======================================\n\n`;
        scriptContent += `pause\n`;

        // Save master script
        fs.writeFileSync(masterScriptPath, scriptContent, 'utf8');

        return {
            masterScriptPath,
            totalScripts,
            scriptDir: this.scriptDir
        };
    }

    /**
     * Generate individual script content
     */
    generateScriptContent(params) {
        const {
            videoPath,
            startTime,
            duration,
            outputPath,
            width,
            height,
            fps,
            quality,
            bookmarkName
        } = params;

        // Convert time format (HH:MM:SS.mmm to HH:MM:SS)
        const scriptTime = startTime.split('.')[0];

        let content = `@echo off\n`;
        content += `setlocal enabledelayedexpansion\n\n`;
        content += `:: FFmpeg Bookmark GIF Generation Script\n`;
        content += `:: Bookmark: ${bookmarkName}\n`;
        content += `:: Video: ${path.basename(videoPath)}\n`;
        content += `:: Start: ${startTime}\n`;
        content += `:: Duration: ${duration}s\n`;
        content += `:: Output: ${path.basename(outputPath)}\n\n`;

        content += `echo Generating GIF for bookmark: ${bookmarkName}\n`;
        content += `echo Video: ${path.basename(videoPath)}\n`;
        content += `echo Start time: ${startTime}\n`;
        content += `echo Duration: ${duration} seconds\n`;
        content += `echo Output: ${path.basename(outputPath)}\n\n`;

        // Check FFmpeg availability
        content += `:: Check if FFmpeg is available\n`;
        content += `where ffmpeg >nul 2>nul\n`;
        content += `if %ERRORLEVEL% neq 0 (\n`;
        content += `    echo ERROR: FFmpeg not found. Please install FFmpeg and add it to your PATH.\n`;
        content += `    echo Download from: https://ffmpeg.org/download.html\n`;
        content += `    pause\n`;
        content += `    exit /b 1\n`;
        content += `)\n\n`;

        // Create temporary directory
        content += `:: Create temporary directory for processing\n`;
        content += `set TEMP_DIR=%TEMP%\\ffmpeg_gif_%RANDOM%\n`;
        content += `mkdir "%TEMP_DIR%"\n\n`;

        // Generate palette
        content += `:: Step 1: Generate color palette for better quality\n`;
        content += `echo Generating color palette...\n`;
        content += `ffmpeg -y ^\n`;
        content += `    -ss "${scriptTime}" ^\n`;
        content += `    -t "${duration}" ^\n`;
        content += `    -i "${videoPath}" ^\n`;
        content += `    -vf "fps=${fps},scale=${width}:${height}:flags=lanczos,palettegen=stats_mode=diff" ^\n`;
        content += `    "%TEMP_DIR%\\palette.png" 2>&1\n\n`;

        content += `if %ERRORLEVEL% neq 0 (\n`;
        content += `    echo ERROR: Failed to generate palette\n`;
        content += `    goto :cleanup\n`;
        content += `)\n\n`;

        // Create GIF
        content += `:: Step 2: Create GIF using palette\n`;
        content += `echo Creating GIF...\n`;
        content += `ffmpeg -y ^\n`;
        content += `    -ss "${scriptTime}" ^\n`;
        content += `    -t "${duration}" ^\n`;
        content += `    -i "${videoPath}" ^\n`;
        content += `    -i "%TEMP_DIR%\\palette.png" ^\n`;
        content += `    -lavfi "fps=${fps},scale=${width}:${height}:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=${quality}" ^\n`;
        content += `    "${outputPath}" 2>&1\n\n`;

        content += `if %ERRORLEVEL% neq 0 (\n`;
        content += `    echo ERROR: Failed to create GIF\n`;
        content += `    goto :cleanup\n`;
        content += `)\n\n`;

        // Success message
        content += `if exist "${outputPath}" (\n`;
        content += `    echo SUCCESS: GIF created successfully!\n`;
        content += `    echo Output: ${outputPath}\n`;
        content += `) else (\n`;
        content += `    echo ERROR: Output file was not created\n`;
        content += `    goto :cleanup\n`;
        content += `)\n\n`;

        // Cleanup
        content += `:cleanup\n`;
        content += `echo Cleaning up temporary files...\n`;
        content += `if exist "%TEMP_DIR%" (\n`;
        content += `    rmdir /s /q "%TEMP_DIR%"\n`;
        content += `)\n\n`;
        content += `echo GIF generation completed for: ${bookmarkName}\n\n`;

        return content;
    }

    /**
     * Calculate duration between two time strings
     */
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

        return Math.max(1, Math.round(endSeconds - startSeconds)); // Minimum 1 second
    }

    /**
     * Generate output filename
     */
    generateOutputFileName(fileName, startBookmark, pairIndex, globalPairIndex) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileBaseName = fileName.replace(/\.[^/.]+$/, '').replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 15);
        const safeBookmarkName = startBookmark.name ?
            startBookmark.name.replace(/[^\w\u4e00-\u9fa5]/g, '_').substring(0, 15) :
            `pair_${pairIndex}`;

        return `${fileBaseName}_${safeBookmarkName}_${globalPairIndex}_${timestamp}.gif`;
    }

    /**
     * Clean up old generated scripts
     */
    cleanupOldScripts(maxAgeHours = 24) {
        try {
            const files = fs.readdirSync(this.scriptDir);
            const now = Date.now();
            const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

            files.forEach(file => {
                const filePath = path.join(this.scriptDir, file);
                const stats = fs.statSync(filePath);

                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up old script: ${file}`);
                }
            });
        } catch (error) {
            console.warn('Failed to cleanup old scripts:', error.message);
        }
    }
}

module.exports = BookmarkScriptGenerator;