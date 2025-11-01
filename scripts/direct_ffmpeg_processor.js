/**
 * Direct FFmpeg Processor - Avoid batch script encoding issues by using Node.js directly
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class DirectFFmpegProcessor {
    constructor(options = {}) {
        this.outputDir = options.outputDir || 'D:\\';
        this.defaultWidth = options.defaultWidth || 480;
        this.defaultHeight = options.defaultHeight || 270;
        this.defaultFps = options.defaultFps || 15;
        this.defaultQuality = options.defaultQuality || 20;
    }

    async processBookmarkPair(bookmarkPair, videoPath, options = {}) {
        const {
            start,
            duration,
            fileName,
            pairIndex
        } = bookmarkPair;

        const width = options.width || this.defaultWidth;
        const height = options.height || this.defaultHeight;
        const fps = options.fps || this.defaultFps;
        const quality = options.quality || this.defaultQuality;

        // Generate output filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileBaseName = fileName.replace(/\\.[^.]+$/, '').replace(/[^\\w\\u4e00-\\u9fa5]/g, '_').substring(0, 15);
        const safeBookmarkName = start.name ?
            start.name.replace(/[^\\w\\u4e00-\\u9fa5]/g, '_').substring(0, 15) :
            `pair_${pairIndex}`;
        const outputFileName = `${fileBaseName}_${safeBookmarkName}_${pairIndex}_${timestamp}.gif`;
        const outputPath = path.join(this.outputDir, outputFileName);

        console.log(`Processing bookmark ${pairIndex}: ${start.name || 'Bookmark ' + pairIndex}`);
        console.log(`Video: ${videoPath}`);
        console.log(`Start time: ${start.time}`);
        console.log(`Duration: ${duration}s`);
        console.log(`Output: ${outputPath}`);
        console.log(`Resolution: ${width}x${height}, FPS: ${fps}`);

        try {
            // Create temporary directory
            const tempDir = fs.mkdtempSync('ffmpeg_gif_');
            const palettePath = path.join(tempDir, 'palette.png');

            console.log('\\nStep 1: Generating color palette...');

            // Step 1: Generate palette
            await this.executeFFmpeg([
                '-y',
                '-ss', start.time.split('.')[0], // Remove milliseconds
                '-t', duration.toString(),
                '-i', videoPath,
                '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos,palettegen=stats_mode=diff`,
                palettePath
            ]);

            console.log('Step 2: Generating GIF...');

            // Step 2: Generate GIF using palette
            const bayerScale = Math.max(1, Math.min(5, Math.floor(quality / 4))); // Ensure range 1-5
            await this.executeFFmpeg([
                '-y',
                '-ss', start.time.split('.')[0], // Remove milliseconds
                '-t', duration.toString(),
                '-i', videoPath,
                '-i', palettePath,
                '-lavfi', `fps=${fps},scale=${width}:${height}:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=${bayerScale}`,
                outputPath
            ]);

            // Clean up temp directory
            fs.rmSync(tempDir, { recursive: true, force: true });

            // Verify output file was created
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                console.log(`✅ SUCCESS: GIF created successfully!`);
                console.log(`Output: ${outputPath}`);
                console.log(`File size: ${Math.round(stats.size / 1024)}KB`);
                return {
                    success: true,
                    outputPath,
                    fileSize: stats.size
                };
            } else {
                console.log('❌ ERROR: Output file was not created');
                return {
                    success: false,
                    outputPath,
                    error: 'Output file not created'
                };
            }

        } catch (error) {
            console.log('❌ ERROR: GIF generation failed:', error.message);
            return {
                success: false,
                outputPath,
                error: error.message
            };
        }
    }

    async executeFFmpeg(args) {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            ffmpeg.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, stdout, stderr });
                } else {
                    reject(new Error(`FFmpeg failed with exit code ${code}: ${stderr}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg spawn error: ${error.message}`));
            });
        });
    }
}

module.exports = DirectFFmpegProcessor;