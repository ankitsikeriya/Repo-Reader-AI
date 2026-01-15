/**
 * Simple in-memory rate limiter and cache for Gemini API calls
 * Reduces API usage by caching embeddings and throttling requests
 */

// In-memory cache for embeddings (query -> embedding vector)
const embeddingCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

// Rate limiting state
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

/**
 * Get cached embedding or null if not found/expired
 */
export function getCachedEmbedding(query) {
    const normalizedQuery = query.toLowerCase().trim();
    const cached = embeddingCache.get(normalizedQuery);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Cache HIT] Embedding for: "${query.substring(0, 30)}..."`);
        return cached.embedding;
    }

    if (cached) {
        embeddingCache.delete(normalizedQuery); // Clean up expired
    }

    return null;
}

/**
 * Cache an embedding for future use
 */
export function cacheEmbedding(query, embedding) {
    const normalizedQuery = query.toLowerCase().trim();
    embeddingCache.set(normalizedQuery, {
        embedding,
        timestamp: Date.now()
    });

    // Limit cache size to prevent memory issues
    if (embeddingCache.size > 500) {
        const firstKey = embeddingCache.keys().next().value;
        embeddingCache.delete(firstKey);
    }

    console.log(`[Cache SET] Embedding cached. Total cached: ${embeddingCache.size}`);
}

/**
 * Wait if needed to respect rate limits
 */
export async function waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
        console.log(`[Rate Limit] Waiting ${waitTime}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    lastRequestTime = Date.now();
}

/**
 * Clear the embedding cache (useful for testing)
 */
export function clearCache() {
    embeddingCache.clear();
    console.log("[Cache] Cleared all cached embeddings");
}
