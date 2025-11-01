/**
 * Create English-only scripts to avoid Chinese character encoding issues
 */

const BookmarkProcessor = require('./bookmark_processor');
const path = require('path');
const fs = require('fs');

// Enhanced Bookmark Script Generator that creates English-only scripts
class EnglishBookmarkScriptGenerator {
    constructor(options = {}) {
        this.outputDir = options.outputDir || 'D:\\';
        this.scriptDir = options.scriptDir || path.resolve(__dirname, 'generated_scripts');
        this.defaultWidth = options.defaultWidth || 480;
        this.defaultHeight = options.defaultHeight || 270;
        this.defaultFps = options.defaultFps || 15;
        this.defaultQuality = options.defaultQuality || 20;

        this.ensureDirectoryExists(this.scriptDir);
    }

    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

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

        const scriptTime = startTime.split(':')[0] + ':' + startTime.split(':')[1] + ':' + startTime.split(':')[2].split('.')[0];

        let content = '@echo off\\n';
        content += 'setlocal enabledelayedexpansion\\n\\n';
        content += ':: FFmpeg Bookmark GIF Generation Script\\n';
        content += `:: Bookmark: ${bookmarkName}\\n`;
        content += `:: Video: ${path.basename(videoPath)}\\n`;
        content += `:: Start: ${startTime}\\n`;
        content += `:: Duration: ${duration}s\\n`;
        content += `:: Output: ${path.basename(outputPath)}\\n\\n';

        content += 'echo Generating GIF for bookmark: ' + bookmarkName + '\\n';
        content += 'echo Video: ' + path.basename(videoPath) + '\\n';
        content += 'echo Start time: ' + startTime + '\\n';
        content += 'echo Duration: ' + duration + ' seconds\\n';
        content += 'echo Output: ' + path.basename(outputPath) + '\\n\\n';

        content += ':: Check if FFmpeg is available\\n';
        content += 'where ffmpeg >nul 2>nul\\n';
        content += 'if %ERRORLEVEL% neq 0 (\\n';
        content += '    echo ERROR: FFmpeg not found. Please install FFmpeg and add it to your PATH.\\n';
        content += '    echo Download from: https://ffmpeg.org/download.html\\n';
        content += '    pause\\n';
        content += '    exit /b 1\\n';
        content += ')\\n';
        content += 'echo FFmpeg found successfully\\n';
        content += 'echo.\\n\\n';

        content += ':: Create temporary directory for processing\\n';
        content += 'set TEMP_DIR=%TEMP%\\ffmpeg_gif_%RANDOM%\\n';
        content += 'mkdir "%TEMP_DIR%"\\n';
        content += '\\n';

        content += ':: Step 1: Generate color palette for better quality\\n';
        content += 'echo Step 1: Generating color palette...\\n';
        content += `ffmpeg -y -ss "${scriptTime}" -t "${duration}" -i "${videoPath}" -vf "fps=${fps},scale=${width}:${height}:flags=lanczos,palettegen=stats_mode=diff" "%TEMP_DIR%\\palette.png" 2>&1\\n\\n';

        content += 'if %ERRORLEVEL% neq 0 (\\n';
        content += '    echo ERROR: Failed to generate palette\\n';
        content += '    echo Temporary directory: %TEMP_DIR%\\n';
        content += '    goto :cleanup\\n';
        content += ')\\n';
        content += 'echo Palette generation completed successfully\\n\\n';

        content += ':: Step 2: Create GIF using palette\\n';
        content += 'echo Step 2: Creating GIF...\\n';
        content += `ffmpeg -y -ss "${scriptTime}" -t "${duration}" -i "${videoPath}" -i "%TEMP_DIR%\\palette.png" -lavfi "fps=${fps},scale=${width}:${height}:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=${quality}" "${outputPath}" 2>&1\\n\\n\\n`;

        content += 'if %ERRORLEVEL% neq 0 (\\n';
        content += '    echo ERROR: Failed to create GIF\\n';
        content += '    echo Check if palette file exists:\\n';
        content += '    if exist "%TEMP_DIR%\\palette.png" (\\n';
        content += '        echo Palette file exists: %TEMP_DIR%\\palette.png%\\n';
        content += '    ) else (\\n';
        content += '        echo Palette file missing: %TEMP_DIR%\\palette.png%\\n';
        content += '    )\\n';
        content += '    goto :cleanup\\n';
        content += ')\\n';
        content += 'echo GIF creation completed successfully\\n\\n';

        content += ':: Verify output file was created\\n';
        content += `if exist "${outputPath}" (\\n`;
        content += '    echo.\\n';
        content += '    echo SUCCESS: GIF created successfully!\\n';
        content += '    echo Output file: ' + path.basename(outputPath) + '\\n';
        content += '\\n';
        content += '    for %%A in ("' + outputPath + '") do (\\n';
        content += '        set FILE_SIZE=%%~zA\\n';
        content += '        set /approx FILE_SIZE_MB=!FILE_SIZE!/1048576\\n';
        content += '    )\\n';
        content += '    echo File size: !FILE_SIZE_MB! MB\\n';
        content += ') else (\\n';
        content += '    echo ERROR: Output file was not created\\n';
        content += '    goto :cleanup\\n';
        content += '\\n';

        content += ':cleanup\\n';
        content += 'echo Cleaning up temporary files...\\n';
        content += 'if exist "%TEMP_DIR%" (\\n';
        content += '    rmdir /s /q "%TEMP_DIR%"\\n';
        content += '\\n';

        content += 'echo.\\n';
        content += 'echo GIF generation completed.\\n';
        content += 'exit /b 0\\n';

        return content;
    }

    generateSingleScript(bookmarkPair, videoPath, options = {}) {
        const {
            start,
            duration,
            pairIndex,
            fileName
        } = bookmarkPair;

        const width = options.width || this.defaultWidth;
        const height = options.height || this.defaultHeight;
        const fps = options.fps || this.defaultFps;
        const quality = options.quality || this.defaultQuality;

        // Generate output filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileBaseName = fileName.replace(/\\.[^.]+$/, '').replace(/[^\\w]/g, '_').substring(0, 15);
        const safeBookmarkName = start.name ?
            start.name.replace(/[^\\w\\u4e00-\\u9fa5]/g, '_').substring(0, 15) :
            `pair_${pairIndex}`;
        const outputFileName = `${fileBaseName}_${safeBookmarkName}_${pairIndex}_${timestamp}.gif`;
        const outputPath = path.join(this.outputDir, outputFileName);

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
            bookmarkName: start.name || `Bookmark ${pairIndex}`
        });

        // Save script to file
        const scriptFileName = `bookmark_${fileName.replace(/[^\\w]/g, '_')}_${pairIndex}.bat`;
        const scriptPath = path.join(this.scriptDir, scriptFileName);
        fs.writeFileSync(scriptPath, scriptContent, 'utf8');

        return {
            scriptPath,
            outputPath,
            scriptFileName,
            outputName: outputFileName
        };
    }

    generateMasterScript(scripts, fileName) {
        let content = '@echo off\\n';
        content += 'setlocal enabledelayedexpansion\\n\\n';
        content += ':: Master Script for Batch Bookmark GIF Generation\\n';
        content += `:: File: ${fileName}\\n`;
        content += '::\\n';

        content += 'echo Starting GIF generation from bookmarks...\\n';
        content += 'echo.\\n\\n';

        content += 'set successCount=0\\n';
        content += 'set totalCount=' + scripts.length + '\\n\\n';

        scripts.forEach((script, index) => {
            content += `echo Processing script ${index + 1}/${scripts.length}: ${path.basename(script.scriptPath)}\\n`;
            content += `call "${script.scriptPath}"\\n`;
            content += `if !ERRORLEVEL! equ 0 (\\n`;
            content += `    echo SUCCESS: ${script.outputName}\\n`;
            content += `    set /a successCount+=1\\n`;
            content += `) else (\\n`;
            content += `    echo ERROR: Failed to process ${script.outputName}\\n`;
            content += `)\\n`;
        });

        content += 'echo Total: !totalCount!\\n';
        content += 'echo Successful: !successCount!\\n';
        content += 'echo Failed: !totalCount! - !successCount!\\n';
        content += 'echo =======================================\\n\\n';
        content += 'pause\\n';

        const masterScriptPath = path.join(this.scriptDir, `master_${fileName}_${Date.now()}.bat`);
        fs.writeFileSync(masterScriptPath, content, 'utf8');

        return masterScriptPath;
    }
}

module.exports = EnglishBookmarkScriptGenerator;