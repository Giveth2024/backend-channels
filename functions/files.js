const fs = require('fs');
const path = require('path');

// Paths to the directories
const outputDir = path.join(__dirname, '..', 'output');
const nickDir = path.join(__dirname, '..', 'Nickelodeon'); // Path to the new folder
const disneyXD = path.join(__dirname, '..', 'disneyxd'); // Path to the new folder
const disneyJunior = path.join(__dirname, '..', 'disneyJunior'); // Path to the new folder

// Helper function to scan and log folder contents
function scanFolder(folderPath, folderName) {
    if (!fs.existsSync(folderPath)) {
        console.log(`⚠️  ${folderName} folder does not exist yet.`);
        return;
    }

    try {
        const files = fs.readdirSync(folderPath);
        // Filter out hidden files like .gitkeep or .DS_Store
        const activeFiles = files.filter(f => !f.startsWith('.'));

        if (activeFiles.length === 0) {
            console.log(`💨 No files found in the ${folderName} folder.`);
        } else {
            console.log(`📊 ${folderName} Total Files: ${activeFiles.length}`);
            console.log(`📄 Files: [ ${activeFiles.join(', ')} ]`);
        }
    } catch (err) {
        console.error(`❌ Error reading ${folderName} folder:`, err);
    }
}

function monitorFiles() {
    console.log(`--- 📂 File Monitor (${new Date().toLocaleTimeString()}) ---`);

    // Check the original output folder
    scanFolder(outputDir, 'Output');

    // Check the Nickelodeon folder
    scanFolder(nickDir, 'Nickelodeon');

    // Check the DisneyXD folder
    scanFolder(disneyXD, 'DisneyXD');

    // Check the Disney Junior folder
    scanFolder(disneyJunior, 'Disney Junior');

    console.log('------------------------------------------');
}

// Export the function to be used in server.js
module.exports = { monitorFiles };