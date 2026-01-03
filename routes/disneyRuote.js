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
        '-loglevel', 'error',               // Hide spam, only show real errors
        '-reconnect', '1',                  // Reconnect if the input stream drops
        '-reconnect_at_eof', '1',           // Reconnect if the file ends unexpectedly
        '-reconnect_streamed', '1',         // Essential for online .m3u8 sources
        '-reconnect_delay_max', '5',        // Max 5 seconds wait before retry
        '-fflags', '+genpts+igndts',        // Ignore timestamp errors from source
        '-i', 'https://fl31.moveonjoy.com/DISNEY/index.m3u8',
        '-map', '0:v', '-map', '0:a',
        '-c:v', 'copy',                     // 'copy' is good, uses less CPU
        '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '10',
        '-hls_flags', 'delete_segments+append_list+discont_start', // discont_start helps players handle gaps
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
   FRONTEND PING
============================ */
router.get('/disney/ping', (req, res) => {
  lastPing = Date.now();
  res.json({ status: 'alive' });
});


/* ============================
   STOP STREAM
============================ */
function stopStream() {
    // 1. Only run if ffmpegProcess actually exists
    if (!ffmpegProcess) {
        return; 
    }

    console.log('🛑 Stopping Disney stream...');
    
    // Kill the process
    ffmpegProcess.kill('SIGKILL');
    ffmpegProcess = null; // Set to null immediately to prevent double-run

    stopMonitor();

    // 2. Wait for FFmpeg to fully release files before clearing
    setTimeout(() => {
        clearOutputFolder();
    }, 2000);
}

/* ============================
   CLEANUP FUNCTION
============================ */
function clearOutputFolder() {
    if (!fs.existsSync(outputDir)) return;

    fs.readdir(outputDir, (err, files) => {
        if (err) {
            console.error('Error reading output folder:', err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(outputDir, file);
            
            // 3. Check if file exists BEFORE trying to delete it
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (unlinkErr) {
                    // Ignore errors if file disappeared between existsSync and unlink
                }
            }
        });
        console.log('🧹 Output folder cleared.');
    });
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