import { Pinecone } from '@pinecone-database/pinecone';

if (!process.env.PINECONE_API_KEY) {
    throw new Error('Missing PINECONE_API_KEY environment variable');
}

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

export const indexName = process.env.PINECONE_INDEX_NAME || "notebooklm-clone";

if (indexName.includes("://") || indexName.includes("pinecone.io")) {
    throw new Error(`Invalid PINECONE_INDEX_NAME: "${indexName}". It looks like a URL. Please set it to the Index Name only (e.g., "notebooklm-clone").`);
}

export default pinecone;
