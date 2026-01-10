const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const logFile = path.resolve(__dirname, '../test_models_log.txt');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

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
        log("Loaded .env.local");
    }
}

if (!process.env.GOOGLE_API_KEY) loadEnv();

async function testModels() {
    log("Testing which Gemini models have available quota...\n");

    const candidates = [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-flash-latest",
        "gemini-pro-latest"
    ];

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    for (const modelName of candidates) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Say OK");
            const text = result.response.text();
            log(`✅ ${modelName}: WORKS - "${text.substring(0, 30)}..."`);
        } catch (error) {
            if (error.message.includes("429")) {
                log(`❌ ${modelName}: QUOTA EXHAUSTED (429)`);
            } else if (error.message.includes("404")) {
                log(`❌ ${modelName}: NOT FOUND (404)`);
            } else {
                log(`❌ ${modelName}: ERROR - ${error.message.substring(0, 50)}`);
            }
        }
    }

    log("\nDone. Check above for a model marked ✅ WORKS.");
}

testModels();
