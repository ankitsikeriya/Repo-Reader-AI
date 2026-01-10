const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { TaskType } = require("@google/generative-ai");
const { Pinecone } = require('@pinecone-database/pinecone');

const logFile = path.resolve(__dirname, '../debug_log.txt');
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

// Clear log file
if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

// Load environment variables manually
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
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
        log("Environment variables loaded from .env.local");
    } else {
        log(".env.local not found");
    }
}

async function debugChat() {
    loadEnv();

    log("--- Debugging Chat Pipeline ---");
    log(`GOOGLE_API_KEY Present: ${!!process.env.GOOGLE_API_KEY}`);
    log(`PINECONE_API_KEY Present: ${!!process.env.PINECONE_API_KEY}`);
    log(`PINECONE_INDEX_NAME: ${process.env.PINECONE_INDEX_NAME}`);

    if (!process.env.GOOGLE_API_KEY || !process.env.PINECONE_API_KEY) {
        log("Missing API Keys!");
        return;
    }

    const indexName = process.env.PINECONE_INDEX_NAME || "notebooklm-clone";

    try {
        // 1. Test Embedding
        log("\n1. Testing Embeddings...");
        const embeddings = new GoogleGenerativeAIEmbeddings({
            modelName: "text-embedding-004",
            taskType: TaskType.RETRIEVAL_QUERY,
            apiKey: process.env.GOOGLE_API_KEY,
        });

        const query = "Hello world";
        const queryEmbedding = await embeddings.embedQuery(query);
        log(`Embedding generated successfully. Length: ${queryEmbedding.length}`);

        // 2. Test Pinecone Connection
        log("\n2. Testing Pinecone Connection...");
        try {
            const pinecone = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY,
            });
            const index = pinecone.Index(indexName);

            // Try a dummy query
            const queryResponse = await index.query({
                vector: queryEmbedding,
                topK: 1,
                includeMetadata: true,
            });
            log("Pinecone query successful.");
            log(`Matches found: ${queryResponse.matches.length}`);
        } catch (pcError) {
            log("❌ Pinecone Error: " + pcError.message);
        }

        // 3. Test Gemini Chat
        log("\n3. Testing Gemini Chat API...");
        const llm = new ChatGoogleGenerativeAI({
            model: "gemini-flash-latest",
            apiKey: process.env.GOOGLE_API_KEY,
        });

        const response = await llm.invoke("Say 'System Check OK' if you can hear me.");
        log("Gemini response: " + response.content);

        log("\n--- SUCCESS: All components appear to be working. ---");

    } catch (error) {
        log("\n--- ERROR DETECTED ---");
        log("Name: " + error.name);
        log("Message: " + error.message);
        if (error.cause) log("Cause: " + JSON.stringify(error.cause, null, 2));
        if (error.stack) log("Stack: " + error.stack);
    }
}

debugChat();
