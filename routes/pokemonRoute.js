const express = require('express');
const axios = require('axios');
const NodeCache = require("node-cache");
const path = require('path');
const cors = require("cors");
const router = express.Router();

const segmentCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // Cache for 5 mins

const PLUTO_BASE_URL = "https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv/stitch/hls/channel/6675c7868768aa0008d7f1c7";
const MASTER_URL = `${PLUTO_BASE_URL}/master.m3u8?terminate=false&appName=web&appVersion=unknown&clientTime=0&deviceDNT=0&deviceId=d3595b5a-7553-4a6b-b9dd-c30951631395&deviceMake=Chrome&deviceModel=web&deviceType=web&deviceVersion=unknown&includeExtendedEvents=false&serverSideAds=false&sid=bc32713f-dc5f-45d9-8650-2b4e69506b23`;


// 1. Get Quality and return the specific playlist URL
router.get('/quality/:id', async (req, res) => {
    try {
        const qualityIndex = parseInt(req.params.id);
        const response = await axios.get(MASTER_URL);
        const lines = response.data.split('\n');
        
        // Filter lines that are playlist URIs (usually follow #EXT-X-STREAM-INF)
        const playlists = lines.filter(line => line.includes('playlist.m3u8'));
        
        if (playlists[qualityIndex]) {
            // Return the watch URL for our local proxy
            res.json({ url: `/pokemon/watch?path=${encodeURIComponent(playlists[qualityIndex])}` });
        } else {
            res.status(404).send('Quality level not found');
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// 2. Watch endpoint (Proxies the .m3u8 and caches segments)
router.get('/watch', async (req, res) => {
    try {
        const relativePath = req.query.path;
        const fullUrl = `${PLUTO_BASE_URL}/${relativePath}`;
        
        const response = await axios.get(fullUrl);
        let manifest = response.data;

        // Pre-cache segments found in this manifest (3-5 ahead logic)
        const segmentUrls = manifest.match(/https?:\/\/[^ \n]+\.ts/g) || [];
        segmentUrls.slice(0, 5).forEach(url => {
            fetchAndCacheSegment(url);
        });

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(manifest);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Helper: Fetch and store in memory cache
async function fetchAndCacheSegment(url) {
    if (segmentCache.has(url)) return;
    try {
        const resp = await axios.get(url, { responseType: 'arraybuffer' });
        segmentCache.set(url, resp.data);
        console.log(`Cached: ${url.substring(url.lastIndexOf('/') + 1)}`);
    } catch (e) {
        console.error("Cache fail", e.message);
    }
}

// 3. Segment proxy (The player calls this if you rewrite manifest URLs, 
// or you can let the player call the siloh-ns1 URLs directly)
router.get('/proxy-segment', async (req, res) => {
    const url = req.query.url;
    let data = segmentCache.get(url);
    
    if (!data) {
        const resp = await axios.get(url, { responseType: 'arraybuffer' });
        data = resp.data;
    }
    res.end(data);
});

module.exports = router;