const fs = require('fs');
const path = require('path');

// Adjust this path to match your project structure
const outputDir = path.join(__dirname, 'output');

function monitorFiles() {
    console.log(`--- 📂 File Monitor (${new Date().toLocaleTimeString()}) ---`);

    if (!fs.existsSync(outputDir)) {
        console.log('⚠️  Output folder does not exist yet.');
        return;
    }

    fs.readdir(outputDir, (err, files) => {
        if (err) {
            console.error('❌ Error reading output folder:', err);
            return;
        }

        // Filter out hidden files like .gitkeep or .DS_Store
        const activeFiles = files.filter(f => !f.startsWith('.'));

        if (activeFiles.length === 0) {
            console.log('💨 No files found in the output folder.');
        } else {
            console.log(`📊 Total Files: ${activeFiles.length}`);
            console.log(`📄 Files: [ ${activeFiles.join(', ')} ]`);
        }
        console.log('------------------------------------------');
    });
}

// Export the function to be used in server.js
module.exports = { monitorFiles };