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

app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;
    if (!streamUrl) return res.status(400).send("No URL provided");

    try {
        const response = await axios.get(streamUrl, {
            headers: {
                'Origin': 'https://pluto.tv',
                'Referer': 'https://pluto.tv',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        let manifestData = response.data;

        // 1. Find the base URL of the Pluto TV stream (everything before the last /)
        const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/'));

        // 2. Rewrite relative URLs to point back to our proxy
        // This regex finds lines that don't start with '#' (comments/tags) and aren't absolute URLs
        const rewrittenManifest = manifestData.split('\n').map(line => {
            if (line.trim() && !line.startsWith('#') && !line.startsWith('http')) {
                // Construct the full Pluto URL for this segment/playlist
                const fullUrl = `${baseUrl}/${line.trim()}`;
                // Route it through our proxy again
                return `http://localhost:${PORT}/proxy?url=${encodeURIComponent(fullUrl)}`;
            }
            return line;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewrittenManifest);
    } catch (error) {
        console.error("Proxy Error:", error.message);
        res.status(500).send("Error fetching the stream");
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});