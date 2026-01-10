const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

const logFile = path.resolve(__dirname, '../models_list.txt');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

function loadEnv() {
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
        log("Could not load .env.local: " + e.message);
    }
}

if (!process.env.GOOGLE_API_KEY) {
    loadEnv();
}

async function listDifferentModels() {
    log("Checking available models for API Key: " + (process.env.GOOGLE_API_KEY ? "Present" : "Missing"));

    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-001",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-pro",
        "gemini-1.0-pro"
    ];

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    for (const modelName of candidates) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hi");
            log(`✅ OK: ${modelName}`);
        } catch (error) {
            log(`❌ FAILED ${modelName}: ${error.message}`);
        }
    }
}

listDifferentModels();
