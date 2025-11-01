// DOM Elements
const filePathInput = document.getElementById('filePath');
const browseBtn = document.getElementById('browseBtn');
const processBtn = document.getElementById('processBtn');
const statusDiv = document.getElementById('status');
const formatSelect = document.getElementById('format');

// Bookmark elements
const bookmarkInfo = document.getElementById('bookmarkInfo');
const bookmarkList = document.getElementById('bookmarkList');

// Subtitle elements
const subtitleInfo = document.getElementById('subtitleInfo');
const subtitleList = document.getElementById('subtitleList');

// Global data
let currentBookmarks = [];
let currentSubtitles = [];
let currentPBFFiles = []; // Store multiple PBF files
let allPBFBookmarks = []; // Store bookmarks from all PBF files

// Time selection elements
const hoursSelect = document.getElementById('hours');
const minutesSelect = document.getElementById('minutes');
const secondsSelect = document.getElementById('seconds');
const millisecondsInput = document.getElementById('milliseconds');

// Duration selection element
const durationSelect = document.getElementById('duration');

// Global error handler for renderer process
window.addEventListener('error', (event) => {
    console.error('Renderer process error:', event.error);
    event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

// Initialization function
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeTimeSelects();
        initializeDurationSelect();
        setupEventListeners();
        setupPotPlayerListener();
        await loadSavedSettings();
        console.log('Renderer process initialized successfully');
    } catch (error) {
        console.error('Renderer process initialization failed:', error);
    }
});

// Initialize time selection dropdowns
function initializeTimeSelects() {
    // Hours (0-23)
    for (let i = 0; i <= 23; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = option.value;
        hoursSelect.appendChild(option);
    }
    hoursSelect.value = '00';

    // Minutes (0-59)
    for (let i = 0; i <= 59; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = option.value;
        minutesSelect.appendChild(option);
    }
    minutesSelect.value = '00';

    // Seconds (0-59)
    for (let i = 0; i <= 59; i++) {
        const option = document.createElement('option');
        option.value = i.toString().padStart(2, '0');
        option.textContent = option.value;
        secondsSelect.appendChild(option);
    }
    secondsSelect.value = '00';
}

// Initialize duration selection dropdown
function initializeDurationSelect() {
    for (let i = 1; i <= 100; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i}`; // Only show numbers
        durationSelect.appendChild(option);
    }
    durationSelect.value = '1';
}

// Set up event listeners
function setupEventListeners() {
    // File browse button
    browseBtn.addEventListener('click', handleFileBrowse);

    // Process button
    processBtn.addEventListener('click', handleProcess);

    // Format selection change
    formatSelect.addEventListener('change', handleFormatChange);

    // Enable/disable process button when file path changes
    filePathInput.addEventListener('input', updateProcessButton);

    // Milliseconds input validation
    millisecondsInput.addEventListener('input', validateMilliseconds);

    // Save settings on any change
    filePathInput.addEventListener('input', debounce(saveCurrentSettings, 500));
    hoursSelect.addEventListener('change', debounce(saveCurrentSettings, 500));
    minutesSelect.addEventListener('change', debounce(saveCurrentSettings, 500));
    secondsSelect.addEventListener('change', debounce(saveCurrentSettings, 500));
    millisecondsInput.addEventListener('input', debounce(saveCurrentSettings, 500));
    durationSelect.addEventListener('change', debounce(saveCurrentSettings, 500));

    // Save settings on format change
    const formatRadios = document.getElementsByName('format');
    formatRadios.forEach(radio => {
        radio.addEventListener('change', handleFormatChange);
    });

    // Save settings on page unload (crash recovery)
    window.addEventListener('beforeunload', saveCurrentSettings);

    // Add event listeners for increment/decrement buttons
    const timeButtons = document.querySelectorAll('.time-btn');
    timeButtons.forEach(button => {
        button.addEventListener('click', handleTimeButtonClick);
    });
}

// Debounce function for settings saving
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle file browsing
async function handleFileBrowse() {
    try {
        const selectedFormat = getSelectedFormat();
        const filePaths = await window.electronAPI.selectFile(selectedFormat);
        if (filePaths) {
            // Handle both single file path and array of file paths
            if (selectedFormat === 'bookmark-gif' && Array.isArray(filePaths)) {
                // Multiple PBF files selected
                filePathInput.value = `${filePaths.length} 个PBF文件已选择`;
                currentPBFFiles = filePaths; // Store all selected PBF files
                await parseMultiplePBFFiles(filePaths);
            } else {
                // Single file selected (for other formats or fallback)
                const filePath = Array.isArray(filePaths) ? filePaths[0] : filePaths;
                filePathInput.value = filePath;
                currentPBFFiles = [filePath]; // Store as single-item array

                // If bookmark format, parse the PBF file
                if (selectedFormat === 'bookmark-gif') {
                    await parsePBFFile(filePath);
                } else if (selectedFormat === 'subtitle') {
                    await detectSubtitles(filePath);
                } else {
                    // Hide bookmark and subtitle info for other formats
                    bookmarkInfo.style.display = 'none';
                    subtitleInfo.style.display = 'none';
                    currentBookmarks = [];
                    currentSubtitles = [];
                }
            }

            updateProcessButton();
            showStatus('File selected successfully', 'success');
            // Save settings immediately after file selection
            await saveCurrentSettings();
        }
    } catch (error) {
        showStatus(`File selection failed: ${error.message}`, 'error');
    }
}

// Validate milliseconds input
function validateMilliseconds() {
    let value = parseInt(millisecondsInput.value) || 0;
    if (value < 0) value = 0;
    if (value > 999) value = 999;
    millisecondsInput.value = value;
}

// Update process button state
function updateProcessButton() {
    processBtn.disabled = !filePathInput.value.trim();
}

// Get selected format
function getSelectedFormat() {
    return formatSelect.value || 'gif'; // Default value
}

// Get start time
function getStartTime() {
    const hours = hoursSelect.value;
    const minutes = minutesSelect.value;
    const seconds = secondsSelect.value;
    const milliseconds = millisecondsInput.value.padStart(3, '0');

    return `${hours}:${minutes}:${seconds}:${milliseconds}`;
}

// Get duration
function getDuration() {
    return durationSelect.value;
}

// Handle time increment/decrement button clicks
function handleTimeButtonClick(event) {
    const target = event.target.dataset.target;
    const action = event.target.dataset.action;

    if (!target || !action) return;

    try {
        let element;
        if (target === 'hours' || target === 'minutes' || target === 'seconds') {
            element = document.getElementById(target);
        } else if (target === 'milliseconds') {
            element = document.getElementById('milliseconds');
        } else if (target === 'duration') {
            element = document.getElementById('duration');
        }

        if (!element) return;

        if (element.tagName === 'SELECT') {
            // Handle select elements
            const currentValue = parseInt(element.value);
            const min = target === 'duration' ? 1 : 0;
            const max = target === 'hours' ? 23 : (target === 'duration' ? 100 : 59);

            let newValue;
            if (action === 'increment') {
                newValue = Math.min(currentValue + 1, max);
            } else {
                newValue = Math.max(currentValue - 1, min);
            }

            // For duration, use simple number string, for time use padded format
            if (target === 'duration') {
                element.value = newValue.toString();
            } else {
                element.value = newValue.toString().padStart(2, '0');
            }
        } else {
            // Handle input elements (milliseconds)
            let currentValue = parseInt(element.value) || 0;
            const min = 0;
            const max = 999;

            if (action === 'increment') {
                currentValue = Math.min(currentValue + 1, max);
            } else {
                currentValue = Math.max(currentValue - 1, min);
            }

            element.value = currentValue;
        }

        // Save settings after change
        saveCurrentSettings();
    } catch (error) {
        console.error('Error handling time button click:', error);
    }
}

// Get current settings
function getCurrentSettings() {
    return {
        filePath: filePathInput.value.trim(),
        format: getSelectedFormat(),
        hours: hoursSelect.value,
        minutes: minutesSelect.value,
        seconds: secondsSelect.value,
        milliseconds: millisecondsInput.value.padStart(3, '0'),
        duration: durationSelect.value
    };
}

// Save current settings
async function saveCurrentSettings() {
    try {
        const settings = getCurrentSettings();
        await window.electronAPI.saveSettings(settings);
        console.log('Settings saved successfully');
    } catch (error) {
        console.error('Failed to save settings:', error);
    }
}

// Load saved settings
async function loadSavedSettings() {
    try {
        const settings = await window.electronAPI.loadSettings();

        // Apply loaded settings to UI
        if (settings.filePath) {
            filePathInput.value = settings.filePath;
        }

        if (settings.hours) {
            hoursSelect.value = settings.hours;
        }

        if (settings.minutes) {
            minutesSelect.value = settings.minutes;
        }

        if (settings.seconds) {
            secondsSelect.value = settings.seconds;
        }

        if (settings.milliseconds) {
            millisecondsInput.value = settings.milliseconds;
        }

        if (settings.duration) {
            durationSelect.value = settings.duration;
        }

        // Set format radio button
        if (settings.format) {
            const formatRadios = document.getElementsByName('format');
            for (const radio of formatRadios) {
                if (radio.value === settings.format) {
                    radio.checked = true;
                    break;
                }
            }
        }

        // Update process button state
        updateProcessButton();

        console.log('Settings loaded successfully');
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Show status information with enhanced error handling
function showStatus(message, type = 'info') {
    try {
        if (!statusDiv) {
            console.error('Status div not found');
            return;
        }

        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';

        // Automatically hide success and info messages after 3 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                try {
                    if (statusDiv && statusDiv.style && statusDiv.parentNode) {
                        statusDiv.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error hiding status:', error);
                }
            }, 3000);
        }
    } catch (error) {
        console.error('Error showing status:', error);
    }
}

// Handle video processing
async function handleProcess() {
    const filePath = filePathInput.value.trim();
    const format = getSelectedFormat();
    const startTime = getStartTime();
    const duration = getDuration();

    // Validate input
    if (!filePath || currentPBFFiles.length === 0) {
        if (format === 'bookmark-gif') {
            showStatus('Please select PBF bookmark files first', 'error');
        } else if (format === '7zip') {
            showStatus('Please select a folder to compress first', 'error');
        } else {
            showStatus('Please select a video file first', 'error');
        }
        return;
    }

    // Special validation for bookmark format
    if (format === 'bookmark-gif') {
        if (allPBFBookmarks.length === 0 && currentBookmarks.length === 0) {
            showStatus('No bookmarks loaded. Please select valid PBF files.', 'error');
            return;
        }

        const totalBookmarks = allPBFBookmarks.length > 0 ?
            allPBFBookmarks.reduce((sum, pbf) => sum + pbf.bookmarks.length, 0) :
            currentBookmarks.length;

        if (totalBookmarks < 2) {
            showStatus('Need at least 2 bookmarks to create GIF segments.', 'error');
            return;
        }
    }

    // Disable button and show processing status
    processBtn.disabled = true;
    if (format === 'bookmark-gif') {
        processBtn.textContent = 'Generating GIFs from bookmarks...';

        const totalBookmarks = allPBFBookmarks.length > 0 ?
            allPBFBookmarks.reduce((sum, pbf) => sum + pbf.bookmarks.length, 0) :
            currentBookmarks.length;

        showStatus(`正在从 ${Math.floor(totalBookmarks / 2)} 个书签对生成GIF，请稍候...`, 'info');
    } else if (format === '7zip') {
        processBtn.textContent = 'Compressing with 7Zip...';
        showStatus('正在压缩文件夹，请稍候...', 'info');
    } else {
        processBtn.textContent = 'Processing...';
        showStatus('Processing video, please wait...', 'info');
    }

    try {
        const processData = {
            filePath,
            format,
            startTime,
            duration
        };

        // Add bookmarks for bookmark-gif format
        if (format === 'bookmark-gif') {
            if (allPBFBookmarks.length > 0) {
                // Multiple PBF files
                processData.pbfFiles = currentPBFFiles;
                processData.allBookmarks = allPBFBookmarks;
            } else {
                // Single PBF file
                processData.bookmarks = currentBookmarks;
            }
        }

        const result = await window.electronAPI.processVideo(processData);

        if (result.success) {
            if (format === 'bookmark-gif' && result.results) {
                // Show detailed results for bookmark processing
                showDetailedResults(result.results);
            } else {
                showStatus(result.message || 'Video processing completed!', 'success');
            }
        } else {
            showStatus(result.message || 'Processing failed', 'error');
        }
    } catch (error) {
        showStatus(`Processing failed: ${error.message}`, 'error');
    } finally {
        // Restore button state with enhanced error handling
        try {
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.textContent = 'Start Processing';
            }
        } catch (buttonError) {
            console.error('Error restoring button state:', buttonError);
        }
    }
}

// Show detailed results for bookmark processing
function showDetailedResults(results) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    let message = `书签处理完成！成功 ${successCount} 个`;
    if (failureCount > 0) {
        message += `，失败 ${failureCount} 个`;
    }

    // Show summary
    showStatus(message, successCount > 0 ? 'success' : 'error');

    // Log detailed results to console
    console.log('Bookmark processing results:', results);

    // Show details in a more user-friendly way
    setTimeout(() => {
        const details = results.map((result, index) => {
            if (result.success) {
                return `✅ 片段 ${result.pairIndex}: ${result.name} (${result.startTime} -> ${result.endTime}, ${result.duration}s)`;
            } else {
                return `❌ 片段 ${result.pairIndex}: ${result.error}`;
            }
        }).join('\n');

        console.log('Detailed processing results:\n' + details);
    }, 1000);
}

// Setup PotPlayer time update listener
function setupPotPlayerListener() {
    window.electronAPI.onPotPlayerTimeUpdate((event, timeString) => {
        try {
            console.log('Received PotPlayer time update:', timeString);

            // Parse time string (format: HH:MM:SS:mmm)
            const timeParts = timeString.split(':');
            if (timeParts.length === 4) {
                const [hours, minutes, seconds, milliseconds] = timeParts;

                // Update time selection elements
                if (hoursSelect) hoursSelect.value = hours;
                if (minutesSelect) minutesSelect.value = minutes;
                if (secondsSelect) secondsSelect.value = seconds;
                if (millisecondsInput) millisecondsInput.value = milliseconds;

                // Show success status
                showStatus(`PotPlayer time captured: ${hours}:${minutes}:${seconds}.${milliseconds}`, 'success');

                // Save settings with new time
                saveCurrentSettings();

                console.log('Time fields updated with PotPlayer time');
            } else {
                console.error('Invalid time format received:', timeString);
                showStatus('Invalid time format received from PotPlayer', 'error');
            }
        } catch (error) {
            console.error('Error processing PotPlayer time update:', error);
            showStatus('Error processing PotPlayer time', 'error');
        }
    });
}

// Handle format change
function handleFormatChange() {
    const selectedFormat = getSelectedFormat();

    // Clear file path and info when format changes
    filePathInput.value = '';
    bookmarkInfo.style.display = 'none';
    subtitleInfo.style.display = 'none';
    currentBookmarks = [];
    currentSubtitles = [];
    currentPBFFiles = []; // Reset PBF files array
    allPBFBookmarks = []; // Reset all bookmarks array
    updateProcessButton();

    // Update placeholder text based on format
    if (selectedFormat === 'bookmark-gif') {
        filePathInput.placeholder = 'Please select PBF bookmark file(s)...';
    } else if (selectedFormat === 'subtitle') {
        filePathInput.placeholder = 'Please select a video file...';
    } else {
        filePathInput.placeholder = 'Please select a video file...';
    }

    // Save settings
    saveCurrentSettings();
}

// Parse multiple PBF files and display bookmarks
async function parseMultiplePBFFiles(filePaths) {
    try {
        showStatus(`正在解析 ${filePaths.length} 个PBF书签文件...`, 'info');

        allPBFBookmarks = []; // Reset all bookmarks
        let totalBookmarks = 0;
        let successCount = 0;

        // Parse each PBF file
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            const fileName = filePath.split('\\').pop() || filePath.split('/').pop();

            showStatus(`正在解析第 ${i + 1}/${filePaths.length} 个文件: ${fileName}`, 'info');

            try {
                const result = await window.electronAPI.parsePBFBookmarks(filePath);

                if (result.success && result.bookmarks.length > 0) {
                    allPBFBookmarks.push({
                        filePath: filePath,
                        fileName: fileName,
                        bookmarks: result.bookmarks
                    });
                    totalBookmarks += result.bookmarks.length;
                    successCount++;
                } else {
                    console.warn(`Failed to parse ${fileName}: ${result.error}`);
                }
            } catch (error) {
                console.error(`Error parsing ${fileName}:`, error);
            }
        }

        if (allPBFBookmarks.length > 0) {
            displayMultipleBookmarks(allPBFBookmarks);
            showStatus(`成功加载 ${successCount} 个文件，共 ${totalBookmarks} 个书签`, 'success');
        } else {
            showStatus('没有成功解析任何PBF文件', 'error');
            bookmarkInfo.style.display = 'none';
        }
    } catch (error) {
        showStatus(`批量PBF解析失败: ${error.message}`, 'error');
        bookmarkInfo.style.display = 'none';
    }
}

// Parse PBF file and display bookmarks
async function parsePBFFile(filePath) {
    try {
        showStatus('正在解析PBF书签文件...', 'info');

        const result = await window.electronAPI.parsePBFBookmarks(filePath);

        if (result.success) {
            currentBookmarks = result.bookmarks;
            displayBookmarks(result.bookmarks);
            showStatus(`成功加载 ${result.bookmarks.length} 个书签`, 'success');
        } else {
            showStatus(`PBF解析失败: ${result.error}`, 'error');
            bookmarkInfo.style.display = 'none';
        }
    } catch (error) {
        showStatus(`PBF解析失败: ${error.message}`, 'error');
        bookmarkInfo.style.display = 'none';
    }
}

// Display bookmarks from multiple PBF files in the UI
function displayMultipleBookmarks(allBookmarksData) {
    bookmarkInfo.style.display = 'block';

    if (allBookmarksData.length === 0) {
        bookmarkList.innerHTML = '<p>未找到书签</p>';
        return;
    }

    let html = '';
    let totalPairs = 0;

    // Generate HTML for each PBF file
    allBookmarksData.forEach((pbfData, fileIndex) => {
        const { fileName, bookmarks } = pbfData;

        html += `
            <div class="pbf-file-section">
                <div class="pbf-file-header">
                    📁 ${fileName} - ${bookmarks.length} 个书签
                </div>
        `;

        // Create bookmark pairs for this file
        const pairs = [];
        for (let i = 0; i < bookmarks.length - 1; i += 2) {
            const startBookmark = bookmarks[i];
            const endBookmark = bookmarks[i + 1];

            // Calculate duration
            const duration = calculateDurationDisplay(startBookmark.time, endBookmark.time);

            pairs.push({
                start: startBookmark,
                end: endBookmark,
                duration: duration,
                pairIndex: Math.floor(i / 2) + 1,
                fileIndex: fileIndex,
                globalPairIndex: totalPairs + Math.floor(i / 2) + 1
            });
        }

        // Add HTML for bookmark pairs in this file
        if (pairs.length > 0) {
            pairs.forEach(pair => {
                html += `
                    <div class="bookmark-pair">
                        <div class="bookmark-pair-header">
                            片段 ${pair.globalPairIndex}: ${pair.start.name || `书签 ${pair.pairIndex}`}
                        </div>
                        <div class="bookmark-pair-detail">
                            开始: ${pair.start.time}<br>
                            结束: ${pair.end.time}<br>
                            持续时间: ${pair.duration}
                        </div>
                    </div>
                `;
            });
            totalPairs += pairs.length;
        }

        if (bookmarks.length % 2 === 1) {
            html += `
                <div class="bookmark-item" style="color: #666; font-style: italic;">
                    ⚠️ 文件 "${fileName}" 最后一个书签将被忽略 (需要成对的书签)
                </div>
            `;
        }

        html += `</div>`; // Close pbf-file-section
    });

    // Add summary
    html += `
        <div class="bookmarks-summary">
            <strong>总计:</strong> ${allBookmarksData.length} 个文件，${totalPairs} 个GIF片段待生成
        </div>
    `;

    bookmarkList.innerHTML = html;
}

// Display bookmarks in the UI
function displayBookmarks(bookmarks) {
    bookmarkInfo.style.display = 'block';

    if (bookmarks.length === 0) {
        bookmarkList.innerHTML = '<p>未找到书签</p>';
        return;
    }

    // Create bookmark pairs
    const pairs = [];
    for (let i = 0; i < bookmarks.length - 1; i += 2) {
        const startBookmark = bookmarks[i];
        const endBookmark = bookmarks[i + 1];

        // Calculate duration
        const duration = calculateDurationDisplay(startBookmark.time, endBookmark.time);

        pairs.push({
            start: startBookmark,
            end: endBookmark,
            duration: duration,
            pairIndex: Math.floor(i / 2) + 1
        });
    }

    // Generate HTML for bookmark pairs
    let html = '';
    pairs.forEach(pair => {
        html += `
            <div class="bookmark-pair">
                <div class="bookmark-pair-header">
                    片段 ${pair.pairIndex}: ${pair.start.name || `书签 ${pair.pairIndex}`}
                </div>
                <div class="bookmark-pair-detail">
                    开始: ${pair.start.time}<br>
                    结束: ${pair.end.time}<br>
                    持续时间: ${pair.duration}
                </div>
            </div>
        `;
    });

    if (bookmarks.length % 2 === 1) {
        html += `
            <div class="bookmark-item" style="color: #666; font-style: italic;">
                ⚠️ 最后一个书签将被忽略 (需要成对的书签)
            </div>
        `;
    }

    bookmarkList.innerHTML = html;
}

// Calculate duration display
function calculateDurationDisplay(startTime, endTime) {
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
    const duration = Math.max(0, endSeconds - startSeconds);

    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);

    if (hours > 0) {
        return `${hours}小时${minutes}分${seconds}秒`;
    } else if (minutes > 0) {
        return `${minutes}分${seconds}秒`;
    } else {
        return `${seconds}秒`;
    }
}

// Detect subtitles in video file
async function detectSubtitles(videoPath) {
    try {
        showStatus('正在检测视频文件中的字幕...', 'info');

        const result = await window.electronAPI.detectSubtitles(videoPath);

        if (result.success) {
            currentSubtitles = result.subtitles;
            displaySubtitles(result.subtitles);
            showStatus(`检测到 ${result.subtitles.length} 个字幕流`, 'success');
        } else {
            showStatus(`字幕检测失败: ${result.error}`, 'error');
            subtitleInfo.style.display = 'none';
        }
    } catch (error) {
        console.error('Subtitle detection error:', error);
        showStatus(`字幕检测出错: ${error.message}`, 'error');
        subtitleInfo.style.display = 'none';
    }
}

// Display subtitle information
function displaySubtitles(subtitles) {
    if (subtitles.length === 0) {
        subtitleList.innerHTML = '<p>未检测到字幕流</p>';
        subtitleInfo.style.display = 'block';
        return;
    }

    let html = '';
    subtitles.forEach((subtitle, index) => {
        html += `
            <div class="subtitle-item">
                <div><strong>字幕流 ${subtitle.index}</strong></div>
                <div class="subtitle-info">
                    格式: ${subtitle.codec_name || 'Unknown'} |
                    语言: ${subtitle.language || 'Unknown'} |
                    标题: ${subtitle.title || '无'}
                </div>
                <div class="subtitle-actions">
                    <button class="extract-subtitle-btn" onclick="extractSubtitle(${subtitle.index}, '${subtitle.language || 'unknown'}')">
                        提取为SRT
                    </button>
                </div>
            </div>
        `;
    });

    subtitleList.innerHTML = html;
    subtitleInfo.style.display = 'block';
}

// Extract subtitle to SRT file
async function extractSubtitle(streamIndex, language) {
    try {
        const videoPath = filePathInput.value.trim();
        if (!videoPath) {
            showStatus('请先选择视频文件', 'error');
            return;
        }

        showStatus(`正在提取字幕流 ${streamIndex}...`, 'info');

        const result = await window.electronAPI.extractSubtitle(videoPath, streamIndex, language);

        if (result.success) {
            showStatus(`字幕提取成功: ${result.outputPath}`, 'success');
        } else {
            showStatus(`字幕提取失败: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Subtitle extraction error:', error);
        showStatus(`字幕提取出错: ${error.message}`, 'error');
    }
}

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getSelectedFormat,
        getStartTime,
        getDuration,
        validateMilliseconds,
        detectSubtitles,
        extractSubtitle
    };
}