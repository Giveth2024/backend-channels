const express = require('express');
const router = express.Router();
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

router.get('/data', (req, res) => {
    res.json({ name: "Pikachu", type: "Electric" });
});

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../pokemon.html'));
});

const PLUTO_HEADERS = {
    'Origin': 'https://pluto.tv',
    'Referer': 'https://pluto.tv',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Connection': 'keep-alive'
};

// Endpoint 1: Master Manifest Handler
router.get('/master', async (req, res) => {
    const { url } = req.query;
    try {
        const response = await axios.get(url, { headers: PLUTO_HEADERS });
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
        
        // Rewrite variants to point to our playlist proxy
        const rewritten = response.data.replace(/^(?!#)(.+)$/gm, (line) => {
            const absolute = line.startsWith('http') ? line : new URL(line, baseUrl).href;
            return `https://backend-channels-5al8.onrender.com/pokemon/playlist?url=${encodeURIComponent(absolute)}`;
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewritten);
    } catch (e) { res.status(500).send("Master fetch failed"); }
});

// Endpoint 2: Playlist & Decryption Proxy
router.get('/playlist', async (req, res) => {
    const { url } = req.query;
    try {
        const response = await axios.get(url, { headers: PLUTO_HEADERS });
        let content = response.data;
        const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

        // 1. DONT strip #EXT-X-DISCONTINUITY. The player NEEDS it to switch 
        // between the Pokemon key and the Ad key.
        
        const rewritten = content.split('\n').map(line => {
            const trimmed = line.trim();
            
            // Handle Key lines
            if (trimmed.startsWith('#EXT-X-KEY')) {
                return trimmed.replace(/URI="(.+?)"/, (m, uri) => {
                    const abs = uri.startsWith('http') ? uri : new URL(uri, baseUrl).href;
                    return `URI="https://backend-channels-5al8.onrender.com/pokemon/decrypt?url=${encodeURIComponent(abs)}"`;
                });
            }

            // Handle TS Segment lines
            if (trimmed && !trimmed.startsWith('#')) {
                const abs = trimmed.startsWith('http') ? trimmed : new URL(trimmed, baseUrl).href;
                return `https://backend-channels-5al8.onrender.com/pokemon/decrypt?url=${encodeURIComponent(abs)}`;
            }

            return line;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewritten);
    } catch (e) {
        res.status(500).send("Playlist Error");
    }
});

// Endpoint 3: Server-side Decryptor
router.get('/decrypt', async (req, res) => {
    const start = Date.now();
    const { url } = req.query;
    try {
        const response = await axios.get(url, { headers: PLUTO_HEADERS, responseType: 'arraybuffer' });
        const duration = Date.now() - start;
        
        // Log telemetry as requested
        console.log(`[200 OK] | Time: ${duration}ms | Size: ${(response.data.byteLength / 1024).toFixed(2)} KB/s | URL: ${url.substring(0, 40)}...`);

        // If it's a key file, just return the raw bytes (16 bytes)
        // If it's a TS file, we send it as is (the hls.js player handles AES if the key is provided)
        res.send(response.data);
    } catch (e) { res.status(500).send("Decrypt fetch failed"); }
});

module.exports = router;