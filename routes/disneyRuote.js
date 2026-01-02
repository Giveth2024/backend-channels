const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 1. Better FFmpeg Path Resolution
let ffmpegPath;
try {
    // Try to use the installer first (works locally)
    ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
} catch (err) {
    // Fallback for Render/Linux environments
    ffmpegPath = 'ffmpeg'; 
}

const router = express.Router();

// Define and Ensure Output Directory exists
const outputDir = path.join(__dirname, '..', 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

let ffmpegProcess = null;
let lastPing = Date.now();
let monitorInterval = null;

/* ============================
   START STREAM
============================ */
router.get('/disney/start', (req, res) => {
    lastPing = Date.now();

    if (ffmpegProcess) {
        return res.json({ status: 'already_running' });
    }

    // Use absolute path for output to avoid confusion
    const outputPath = path.join(outputDir, 'output.m3u8');

    ffmpegProcess = spawn(ffmpegPath, [
        '-fflags', '+genpts',
        '-i', 'https://fl31.moveonjoy.com/DISNEY/index.m3u8',
        '-map', '0:v',
        '-map', '0:a',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ac', '2',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '10',
        '-hls_flags', 'delete_segments+append_list',
        'output.m3u8' // FFmpeg uses the cwd option to place this
    ], {
        cwd: outputDir 
    });

    ffmpegProcess.stderr.on('data', (data) => {
        // Log sparingly to avoid filling Render logs
        if (data.toString().includes('Error')) {
            console.error('ffmpeg error:', data.toString());
        }
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`🎬 FFmpeg process exited with code ${code}`);
        stopStream();
    });

    ffmpegProcess.on('error', (err) => {
        console.error('❌ FFmpeg failed to start:', err.message);
        ffmpegProcess = null;
    });

    startMonitor();
    console.log('🎬 Disney stream started');
    res.json({ status: 'started' });
});

/* ============================
   FRONTEND PING
============================ */
router.get('/disney/ping', (req, res) => {
    lastPing = Date.now();
    res.json({ status: 'alive', running: !!ffmpegProcess });
});

/* ============================
   STOP STREAM
============================ */
function stopStream() {
    if (ffmpegProcess) {
        ffmpegProcess.kill('SIGKILL');
        ffmpegProcess = null;
    }
    stopMonitor();
    console.log('🛑 Disney stream stopped');
}

/* ============================
   MONITOR FRONTEND
============================ */
function startMonitor() {
    if (monitorInterval) return;

    monitorInterval = setInterval(() => {
        if (Date.now() - lastPing > 30000) {
            console.log('⏳ Timeout: No ping received for 30s. Stopping stream...');
            stopStream();
        }
    }, 5000);
}

function stopMonitor() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
}

module.exports = router;