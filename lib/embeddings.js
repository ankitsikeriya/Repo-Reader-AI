/**
 * Jina AI Embeddings wrapper (jina-embeddings-v2-base-en)
 * Drop-in replacement for Google's text-embedding-004 — same 768 dimensions.
 * Includes automatic retry with backoff for rate limit (429) errors.
 */

const JINA_API_URL = "https://api.jina.ai/v1/embeddings";
const JINA_MODEL = "jina-embeddings-v2-base-en";

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 15000; // 15 seconds — Jina free tier is 100K tokens/min

function getApiKey() {
    const key = process.env.JINA_API_KEY;
    if (!key) {
        throw new Error("JINA_API_KEY is missing from environment variables.");
    }
    return key;
}

/**
 * Sleep helper
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Core fetch with automatic retry on 429 rate limit errors
 */
async function fetchWithRetry(body) {
    const apiKey = getApiKey();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(JINA_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (response.ok) {
            return await response.json();
        }

        // Handle rate limiting (429) with exponential backoff
        if (response.status === 429 && attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(1.5, attempt);
            console.warn(
                `Jina rate limited (429). Retrying in ${Math.round(delay / 1000)}s... (attempt ${attempt + 1}/${MAX_RETRIES})`
            );
            await sleep(delay);
            continue;
        }

        // Non-retryable error or max retries exhausted
        const err = await response.text();
        throw new Error(`Jina Embedding API error (${response.status}): ${err}`);
    }
}

/**
 * Embed a single query string → number[]
 */
export async function embedQuery(text) {
    const data = await fetchWithRetry({
        model: JINA_MODEL,
        input: [text],
    });

    if (!data.data || !data.data[0]?.embedding) {
        throw new Error("Jina Embedding API returned empty/invalid vectors.");
    }

    return data.data[0].embedding;
}

/**
 * Embed multiple documents with automatic sub-batching to stay under rate limits.
 * Splits into small batches (10 texts each) with a delay between them.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedDocuments(texts) {
    const SUB_BATCH_SIZE = 10; // ~10 chunks × ~500 tokens ≈ 5K tokens per sub-batch
    const DELAY_BETWEEN_BATCHES_MS = 3000; // 3s pause between sub-batches

    const allEmbeddings = [];

    for (let i = 0; i < texts.length; i += SUB_BATCH_SIZE) {
        const subBatch = texts.slice(i, i + SUB_BATCH_SIZE);

        // Add delay between sub-batches (not before the first one)
        if (i > 0) {
            await sleep(DELAY_BETWEEN_BATCHES_MS);
        }

        const data = await fetchWithRetry({
            model: JINA_MODEL,
            input: subBatch,
        });

        if (!data.data || data.data.length === 0) {
            throw new Error("Jina Embedding API returned empty/invalid vectors.");
        }

        // Sort by index to ensure correct order
        const sorted = data.data.sort((a, b) => a.index - b.index);
        allEmbeddings.push(...sorted.map((item) => item.embedding));
    }

    return allEmbeddings;
}
