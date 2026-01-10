const fs = require('fs');
const path = require('path');

async function listDifferentModels() {
    const logFile = path.resolve(__dirname, 'model_log.txt');
    fs.writeFileSync(logFile, `Checking models at ${new Date().toISOString()}\n`);

    // Load env manually if needed
    try {
        const envPath = path.resolve(__dirname, '../.env.local');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf8');
            envConfig.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    process.env[key.trim()] = value.trim();
                }
            });
        }
    } catch (e) {
        fs.appendFileSync(logFile, "Could not load .env.local\n");
    }

    const key = process.env.GOOGLE_API_KEY;
    if (!key) {
        fs.appendFileSync(logFile, "❌ Error: GOOGLE_API_KEY is missing\n");
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.error) {
            fs.appendFileSync(logFile, `❌ API Error: ${JSON.stringify(data.error, null, 2)}\n`);
        } else if (data.models) {
            fs.appendFileSync(logFile, `✅ Success! Found ${data.models.length} models:\n`);
            data.models.forEach(m => {
                // Check if it supports generateContent
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    fs.appendFileSync(logFile, `- ${m.name} (v: ${m.version})\n`);
                }
            });
        } else {
            fs.appendFileSync(logFile, `❓ Unexpected response: ${JSON.stringify(data, null, 2)}\n`);
        }
    } catch (error) {
        fs.appendFileSync(logFile, `❌ Fetch Error: ${error.message}\n`);
    }
}

listDifferentModels();
