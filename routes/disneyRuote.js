const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const router = express.Router();

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

  ffmpegProcess = spawn(ffmpegPath, [ // use ffmpegPath here
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
    'output.m3u8'
  ], {
    cwd: path.join(__dirname, '..', 'output')
  });

  ffmpegProcess.stderr.on('data', (data) => {
    console.log('ffmpeg:', data.toString());
  });

  ffmpegProcess.on('close', stopStream);
  ffmpegProcess.on('error', (err) => {
    console.error('FFmpeg failed to start:', err);
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
  res.json({ status: 'alive' });
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
      stopStream();
    }
  }, 5000);
}

function stopMonitor() {
  clearInterval(monitorInterval);
  monitorInterval = null;
}

module.exports = router;
