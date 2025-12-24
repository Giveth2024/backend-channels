const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());

app.use('/images', express.static(path.join(__dirname, 'images')));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/tomandjerry', (req, res) => {
    res.sendFile(path.join(__dirname, 'tomandjerry.html'));
});

app.get('/server', (req, res) => {
    res.json("Server is running");
});

app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send("No URL provided");

    const protocol = req.protocol;
    const host = req.get('host');
    const proxyBase = `${protocol}://${host}`;

    try {
        const response = await axios.get(streamUrl, {
            responseType: 'arraybuffer', 
            timeout: 10000, // 10s timeout to prevent hanging
            headers: {
                'Origin': 'https://pluto.tv',
                'Referer': 'https://pluto.tv',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Connection': 'close', // 1. CRITICAL: Prevents ECONNRESET by closing connection after each request
                'Accept': '*/*'
            }
        });

        // 2. CRITICAL: Stop the browser/proxy from caching old keys/playlists
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/'));
        
        if (streamUrl.includes('.m3u8')) {
            let manifestData = response.data.toString('utf-8');

            const rewrittenManifest = manifestData.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed) return line;

                const getFullUrl = (path) => {
                    if (path.startsWith('http')) return path;
                    return `${baseUrl}/${path}`;
                };

                // Rewrite Video Segments
                if (!trimmed.startsWith('#')) {
                    return `${proxyBase}/proxy?url=${encodeURIComponent(getFullUrl(trimmed))}`;
                }

                // Rewrite Keys and Subtitles
                if (trimmed.includes('URI="')) {
                    return trimmed.replace(/URI="([^"]+)"/g, (match, p1) => {
                        const fullUrl = getFullUrl(p1);
                        return `URI="${proxyBase}/proxy?url=${encodeURIComponent(fullUrl)}"`;
                    });
                }
                return line;
            }).join('\n');

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewrittenManifest);
        }

        // 3. Handle Binary Files (Keys and .ts segments)
        if (streamUrl.includes('.key')) {
            res.setHeader('Content-Type', 'application/octet-stream');
        } else if (streamUrl.includes('.ts')) {
            res.setHeader('Content-Type', 'video/MP2T');
        }

        return res.send(response.data);

    } catch (error) {
        // Log more detail for debugging
        console.error(`Proxy Error on ${streamUrl.substring(0, 50)}... :`, error.message);
        
        // If it was a timeout or reset, tell the player to try again
        res.status(502).send("Upstream error or reset");
    }
});

const BASE =
  'https://live20.bozztv.com/giatvplayout7/giatv-208314';

app.disable('x-powered-by');

/* ======================================================
   SIMPLE IN-MEMORY TS CACHE
====================================================== */
const tsCache = new Map(); // key -> { buffer, expires }

const TS_TTL = 60 * 1000; // 60 seconds

function setCache(key, buffer) {
  tsCache.set(key, {
    buffer,
    expires: Date.now() + TS_TTL,
  });
}

function getCache(key) {
  const item = tsCache.get(key);
  if (!item) return null;

  if (Date.now() > item.expires) {
    tsCache.delete(key);
    return null;
  }
  return item.buffer;
}

/* ======================================================
   MASTER PLAYLIST
====================================================== */
app.get('/hls/master.m3u8', async (req, res) => {
  try {
    const upstream = await axios.get(`${BASE}/playlist.m3u8`, {
      timeout: 5000,
    });

    const rewritten = upstream.data.replace(
      'tracks-v1a1/mono.ts.m3u8',
      '/hls/media.m3u8'
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewritten);

    console.log('✔ Master playlist');
  } catch (err) {
    console.error('✖ Master error:', err.message);
    res.sendStatus(502);
  }
});

/* ======================================================
   MEDIA PLAYLIST
====================================================== */
app.get('/hls/media.m3u8', async (req, res) => {
  try {
    const upstream = await axios.get(
      `${BASE}/tracks-v1a1/mono.ts.m3u8`,
      { timeout: 5000 }
    );

    const rewritten = upstream.data.replace(
      /(.*\.ts)/g,
      '/hls/segment.ts?file=$1'
    );

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(rewritten);

    console.log('✔ Media playlist');
  } catch (err) {
    console.error('✖ Media error:', err.message);
    res.sendStatus(502);
  }
});

/* ======================================================
   TS SEGMENT — CACHED + STREAMED
====================================================== */
app.get('/hls/segment.ts', async (req, res) => {
  const file = req.query.file;
  if (!file) return res.sendStatus(400);

  const url = `${BASE}/tracks-v1a1/${file}`;
  const start = Date.now();

  // 1️⃣ Serve from cache instantly
  const cached = getCache(file);
  if (cached) {
    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-cache',
    });
    res.end(cached);

    console.log(`⚡ Cache HIT ${file} (${cached.length} bytes)`);
    return;
  }

  // 2️⃣ Fetch once from upstream
  try {
    const upstream = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const buffer = Buffer.from(upstream.data);

    // Save to cache BEFORE responding
    setCache(file, buffer);

    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'no-cache',
    });
    res.end(buffer);

    const time = Date.now() - start;
    const speed = (buffer.length / 1024 / (time / 1000)).toFixed(2);

    console.log(
      `✔ TS ${file} | ${buffer.length} bytes | ${time} ms | ${speed} KB/s`
    );
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      console.log(`⚠ Upstream timeout ${file}`);
      return;
    }

    console.error('✖ TS error:', err.message);
    res.sendStatus(502);
  }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});