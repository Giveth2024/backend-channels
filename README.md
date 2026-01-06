# Multi-Channel HLS Proxy Server

This project is a sophisticated HLS (HTTP Live Streaming) proxy server built with Node.js and Express. It enables the streaming of restricted content (like Pluto TV and other live streams) by bypassing CORS restrictions and spoofing necessary headers, ensuring smooth playback in standard web browsers.

## 🚀 Key Features

- **Multi-Channel Support**: Dedicated routes and pages for various channels:
  - **Nickelodeon**
  - **Disney**
  - **Disney XD**
  - **Pokemon TV**
  - **Tom & Jerry**
- **Smart Proxying**: Handles header spoofing (Origin, Referer, User-Agent) to bypass stream restrictions.
- **Manifest Rewriting**: Dynamically rewrites HLS manifests (`.m3u8`) to route segments and keys through the local proxy.
- **Caching Mechanism**: 
  - **Memory Cache**: Uses `NodeCache` and in-memory maps to cache `.ts` segments, reducing latency and upstream load.
  - **Segment Pre-fetching**: Some routes implement logic to pre-fetch upcoming segments.
- **File Monitoring**: Built-in utility to monitor and log the contents of specific HLS directories (e.g., `output`, `Nickelodeon`, `disneyxd`).
- **Static Assets**: Serves channel-related images and static HLS segments.

## 🛠️ Technology Stack

- **Backend**: Node.js, Express
- **HTTP Client**: Axios
- **Caching**: `node-cache`
- **Utilities**: `ffmpeg` (via `@ffmpeg-installer/ffmpeg` and `ffmpeg-static`)
- **Development**: `nodemon`

## 📂 Project Structure

```text
├── server.js               # Main entry point, core proxy logic, and routing
├── routes/                 # Express router modules for specific channels
│   ├── nickelodeonChannelRoute.js # Nickelodeon API routes
│   ├── disneyRuote.js      # Disney API routes
│   ├── disneyXDRuote.js    # Disney XD API routes
│   └── pokemonRoute.js      # Pokemon TV API routes
├── functions/              # Utility functions
│   └── files.js            # File system monitoring logic
├── images/                 # Thumbnail and logo assets
├── downloads/              # Directory for downloaded content
├── output/                 # Disney HLS output directory
├── Nickelodeon/            # Nickelodeon HLS directory
├── disneyxd/               # Disney XD HLS directory
├── *.html                  # Frontend players for each channel
├── package.json            # Dependencies and scripts
└── reminder.txt            # Project notes
```

## 📦 Getting Started

### Requirements
- Node.js 16+ and `npm`
- `ffmpeg` available on the system PATH (required for stream repackaging endpoints)

### Install
```bash
npm install
```

### Run
- Development (auto-reload):
```bash
npm run dev
```
- Production:
```bash
npm start
```

Server default: `http://localhost:3000`

### Available Pages
- **Nickelodeon**: `http://localhost:3000/nickelodeon`
- **Disney**: `http://localhost:3000/disney`
- **Disney XD**: `http://localhost:3000/disneyxd`
- **Pokemon TV**: `http://localhost:3000/pokemontv`
- **Tom & Jerry**: `http://localhost:3000/tomandjerry`

---

## ⚙️ Behavior Notes & Troubleshooting

- FFmpeg must be installed and accessible on the command line for the `/api/*/start` endpoints to work.
- The server mounts several static folders at `/hls`. If a requested file exists in any mounted directory it will be served (order matters).
- `.ts` segments are cached in-memory for a short TTL (~60s) to reduce repeated upstream requests.
- Proxy endpoints use short timeouts to avoid hanging requests — upstream timeouts return `502`.
- Check console logs for `ffmpeg` errors, TS cache hits, and manifest fetch status when debugging.

## 🧰 Developer Tips
- Use `npm run dev` while iterating — `nodemon` will auto-reload on changes.
- Check the console to see master/media playlist fetch logs and TS caching activity.
- `functions/monitorFiles()` is called on startup and every 30s; it logs folder contents to help confirm HLS fragments are written as expected.


## 🔌 Important API & HLS Endpoints

- GET `/server`
  - Returns a simple status JSON ("Server is running").

- GET `/proxy?url=<URL>`
  - General-purpose proxy for playlists, segments, and keys.
  - Spoofs headers (Origin/Referer/User-Agent) and rewrites `.m3u8` manifests so segment/key URLs point back to the `/proxy` endpoint.
  - Examples:
    - `GET /proxy?url=https://example.com/playlist.m3u8`
    - The proxy sets `Cache-Control: no-cache` to avoid stale keys/playlists.

- HLS aggregator endpoints (based on `BASE` in `server.js`):
  - `/hls/master.m3u8` — local master playlist (rewritten upstream master)
  - `/hls/media.m3u8`  — media playlist rewritten to route `.ts` => `/hls/segment.ts?file=...`
  - `/hls/segment.ts?file=<file>` — serves/caches TS segments using a simple in-memory map (TTL ~ 60s)

- Pokemon-specific endpoints (in `routes/pokemonRoute.js`):
  - `/pokemon/quality/:id` — selects a quality level from the upstream master and returns a local watch URL
  - `/pokemon/watch?path=<relative_path>` — proxies the selected playlist and pre-caches a few TS segments
  - `/pokemon/proxy-segment?url=<url>` — serves cached segment if available, otherwise fetches upstream

- Channel control endpoints (spawn `ffmpeg` to repackage streams locally):
  - `/api/disney/start` — start Disney ffmpeg repackaging (writes `output/output.m3u8`)
  - `/api/disney/ping` — keep-alive ping for the Disney stream
  - `/api/disneyxd/start` and `/api/disneyxd/ping`
  - `/api/nickelodeon/start` and `/api/nickelodeon/ping`
  - `/api/disneyJunior/start` and `/api/disneyJunior/ping`
  - `/api/nickJunior/start` and `/api/nickJunior/ping`
  - `/api/nickToons/start` and `/api/nickToons/ping`

These endpoints are intended for simple control from the frontend players (the HTML pages included) or for manual use (curl/postman).

---
*Created for experimental HLS streaming purposes.*
