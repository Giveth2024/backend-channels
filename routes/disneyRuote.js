const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 1. SIMPLE PATH: Just use 'ffmpeg'. Render knows where this is.
const ffmpegPath = 'ffmpeg'; 

// Ensure the output directory exists
const outputDir = path.join(__dirname, '..', 'output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

let ffmpegProcess = null;
let lastPing = Date.now();
let monitorInterval = null;

router.get('/disney/start', (req, res) => {
    lastPing = Date.now();
    if (ffmpegProcess) return res.json({ status: 'already_running' });

    // 2. SPAWN: Using the system ffmpeg
    ffmpegProcess = spawn(ffmpegPath, [
        '-fflags', '+genpts',
        '-i', 'https://fl31.moveonjoy.com/DISNEY/index.m3u8',
        '-map', '0:v', '-map', '0:a',
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '10',
        '-hls_flags', 'delete_segments+append_list',
        'output.m3u8'
    ], {
        cwd: outputDir 
    });

    ffmpegProcess.on('error', (err) => {
        console.error('❌ FFmpeg failed to start. Render error:', err.message);
    });

    ffmpegProcess.on('close', (code) => {
        console.log(`🎬 Stream closed (Code: ${code})`);
        stopStream();
    });

    startMonitor();
    res.json({ status: 'started' });
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