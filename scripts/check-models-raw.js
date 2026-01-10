const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
function loadEnv() {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        });
    }
}

loadEnv();

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
    console.error("No API KEY found");
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log("Status Code:", res.statusCode);
        try {
            const json = JSON.parse(data);
            if (json.models) {
                console.log("Available Models:");
                json.models.forEach(m => console.log(`- ${m.name} (${m.supportedGenerationMethods})`));
                // Write to file for safety
                fs.writeFileSync(path.resolve(__dirname, '../models_raw.txt'), JSON.stringify(json, null, 2));
            } else {
                console.log("Response:", data);
            }
        } catch (e) {
            console.log("Raw Response:", data);
        }
    });
}).on('error', (e) => {
    console.error("Error:", e);
});
