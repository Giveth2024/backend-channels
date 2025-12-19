HLS Proxy Player for Pluto TV

This project demonstrates how to play restricted HLS (HTTP Live Streaming) content by building a custom Express proxy. It specifically addresses challenges found when attempting to stream Pluto TV content in a standard web browser.
🚀 The Problem

Pluto TV's video streams have two main security layers that prevent them from playing in a standard <video> tag or hls.js instance directly:

    CORS (Cross-Origin Resource Sharing): The browser blocks requests made from your local domain to Pluto's servers.

    Header Verification: Pluto's servers check for specific Origin and Referer headers. If these headers aren't present or are incorrect, the server returns a 403 Forbidden error.

🛠️ The Solution (Step-by-Step)
1. The Proxy Server (server.js)

We created a Node.js server using Express and Axios. Instead of the browser talking to Pluto TV, the browser talks to our server.

    Header Spoofing: Our server makes the request to Pluto TV using Axios, manually attaching the required headers (Origin: https://pluto.tv). Servers talking to servers are not restricted by CORS.

    Content Delivery: Our server receives the video data and pipes it back to the browser, adding the Access-Control-Allow-Origin: * header so the browser allows the data through.

2. Manifest Rewriting (The "Magic" Step)

HLS streams consist of a "Master Manifest" which contains links to "Sub-Manifests" (for different qualities), which then contain links to "Segments" (the actual video chunks).

    The Issue: Pluto TV uses relative paths inside their files (e.g., 1042180/playlist.m3u8). Without modification, your browser tries to find these files on localhost:3000 and fails.

    The Fix: Our Express proxy parses the text of the .m3u8 files. It finds every relative URL and prepends our proxy address to it.

    Result: Every single request—from the master playlist down to the smallest video chunk—is automatically routed through our proxy with the correct headers.

3. Frontend Integration (index.html)

We updated the player to point to our local proxy endpoint:
JavaScript

const hlsUrl = `http://localhost:3000/proxy?url=${encodeURIComponent(ORIGINAL_PLUTO_URL)}`;

This triggers the chain reaction where the hls.js library fetches everything through our Node.js middleware.
📦 Installation & Usage

    Install Dependencies:
    Bash

npm install express axios cors

Run the Server:
Bash

    node server.js

    Access the Player: Open your browser and navigate to http://localhost:3000.

📂 Project Structure

    server.js: The Express backend that handles header spoofing, CORS, and manifest rewriting.

    index.html: The frontend HLS player with a quality selector.

    package.json: Project metadata and dependencies.

    echo "# backend-channels" >> README.md