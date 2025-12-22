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
            // Use arraybuffer so video segments (.ts) aren't corrupted
            responseType: 'arraybuffer', 
            headers: {
                'Origin': 'https://pluto.tv',
                'Referer': 'https://pluto.tv',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/'));
        
        // Only rewrite if it's an HLS playlist (.m3u8)
        if (streamUrl.includes('.m3u8')) {
            let manifestData = response.data.toString('utf-8');

            const rewrittenManifest = manifestData.split('\n').map(line => {
                const trimmed = line.trim();
                if (!trimmed) return line;

                // A. Rewrite standard relative links (Segments/Playlists)
                if (!trimmed.startsWith('#') && !trimmed.startsWith('http')) {
                    const fullUrl = `${baseUrl}/${trimmed}`;
                    return `${proxyBase}/proxy?url=${encodeURIComponent(fullUrl)}`;
                }

                // B. NEW: Rewrite Subtitle/Audio URIs inside tags
                if (trimmed.includes('URI="') && !trimmed.includes('URI="http')) {
                    return trimmed.replace(/URI="([^"]+)"/g, (match, p1) => {
                        const fullUrl = `${baseUrl}/${p1}`;
                        return `URI="${proxyBase}/proxy?url=${encodeURIComponent(fullUrl)}"`;
                    });
                }
                return line;
            }).join('\n');

            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
            return res.send(rewrittenManifest);
        }

        // C. If it's a .ts or .vtt file, just send the raw data
        res.send(response.data);

    } catch (error) {
        console.error("Proxy Error:", error.message);
        res.status(500).send("Error fetching the stream");
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});