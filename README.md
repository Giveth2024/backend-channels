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

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Server
**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

### 3. Access the Channels
Once the server is running, you can access the following pages:
- **Nickelodeon**: `http://localhost:3000/nickelodeon`
- **Disney**: `http://localhost:3000/disney`
- **Disney XD**: `http://localhost:3000/disneyxd`
- **Pokemon TV**: `http://localhost:3000/pokemontv`
- **Tom & Jerry**: `http://localhost:3000/tomandjerry`

## 🔌 API Endpoints

- `/proxy?url=...`: General-purpose HLS proxy with header spoofing.
- `/hls/master.m3u8`: Local master playlist for proxied streams.
- `/pokemon/watch?path=...`: Dedicated Pokemon TV proxy endpoint.
- `/api/...`: Channel-specific API routes (Nickelodeon, Disney, Disney XD).
- `/server`: Simple status check to verify the server is running.

---
*Created for experimental HLS streaming purposes.*
