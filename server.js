const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/server', (req, res) => {
    res.json("Server is running");
});

app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send("No URL provided");

    const protocol = req.protocol;
    const host = req.get('host');
    const proxyBase = `${protocol}s://${host}`;

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
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});