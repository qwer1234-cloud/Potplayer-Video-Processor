// DOM Elements
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const statusText = document.getElementById('statusText');
const currentStatus = document.getElementById('currentStatus');
const cancelBtn = document.getElementById('cancelBtn');

// Initialization
let isProcessing = true;

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeProgress();
});

// Set up event listeners
function setupEventListeners() {
    // Cancel button
    cancelBtn.addEventListener('click', handleCancel);

    // Listen for progress updates
    window.electronAPI.onProgressUpdate((event, data) => {
        updateProgress(data.progress, data.status);
    });
}

// Initialize progress
function initializeProgress() {
    updateProgress(0, 'Preparing to start processing...');
}

// Update progress
function updateProgress(percent, status) {
    // Update progress bar
    progressFill.style.width = `${percent}%`;
    progressPercent.textContent = `${Math.round(percent)}%`;

    // Update status text
    statusText.textContent = status;
    currentStatus.textContent = status;

    // Change styles based on progress
    if (percent >= 100) {
        progressFill.classList.add('complete');
        progressFill.classList.remove('error');
        isProcessing = false;
        cancelBtn.textContent = 'Close';
        cancelBtn.style.background = '#28a745';
    } else if (status === 'Processing failed') {
        progressFill.classList.add('error');
        progressFill.classList.remove('complete');
        isProcessing = false;
        cancelBtn.textContent = 'Close';
        cancelBtn.style.background = '#dc3545';
    } else {
        progressFill.classList.remove('complete', 'error');
        isProcessing = true;
        cancelBtn.textContent = 'Cancel Processing';
        cancelBtn.style.background = '#dc3545';
    }

    // Add progress animation effect
    if (percent > 0 && percent < 100) {
        progressFill.style.transition = 'width 0.5s ease';
    }
}

// Handle cancel operation
function handleCancel() {
    if (isProcessing) {
        // Cancel processing
        if (confirm('Are you sure you want to cancel the current processing?')) {
            // Here you can add logic to cancel processing
            // Currently just close the window
            window.close();
        }
    } else {
        // Close window
        window.close();
    }
}

// Keyboard event listener
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        handleCancel();
    }
});

// Window beforeunload handling
window.addEventListener('beforeunload', (event) => {
    if (isProcessing) {
        event.preventDefault();
        event.returnValue = 'Processing is in progress, are you sure you want to close?';
        return event.returnValue;
    }
});

// 导出函数供测试使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateProgress,
        handleCancel
    };
}