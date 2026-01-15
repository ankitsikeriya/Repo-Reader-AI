
import { NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { Document } from "@langchain/core/documents";
import pinecone, { indexName } from "@/lib/pinecone";
import { loadGitHubRepo, isValidGitHubUrl } from "@/lib/github-loader";

// Allow handling larger files and longer processing for GitHub cloning
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get("file");
        const files = formData.getAll("files"); // Support multiple files
        const text = formData.get("text");
        const githubUrl = formData.get("githubUrl");
        const notebookId = formData.get("notebookId");

        if (!notebookId) {
            return NextResponse.json({ error: "Notebook ID is required" }, { status: 400 });
        }

        if (!file && files.length === 0 && !text && !githubUrl) {
            return NextResponse.json({ error: "No content provided" }, { status: 400 });
        }

        let docs = [];
        let sourceName = "";
        let sourceType = "";

        // 1. Load Content based on source type

        // Handle GitHub URL
        if (githubUrl) {
            console.log(`Processing GitHub repo: ${githubUrl}`);

            if (!isValidGitHubUrl(githubUrl)) {
                return NextResponse.json({ error: "Invalid GitHub URL format" }, { status: 400 });
            }

            docs = await loadGitHubRepo(githubUrl, notebookId);
            sourceName = githubUrl;
            sourceType = "github";
        }
        // Handle single file (backward compatibility)
        else if (file) {
            console.log(`Processing file: ${file.name}`);
            const blob = new Blob([await file.arrayBuffer()], { type: file.type });
            const loader = new WebPDFLoader(blob);
            docs = await loader.load();
            docs.forEach(doc => {
                doc.metadata.source = file.name;
                doc.metadata.sourceType = "pdf";
                doc.metadata.notebookId = notebookId;
            });
            sourceName = file.name;
            sourceType = "pdf";
        }
        // Handle multiple files
        else if (files.length > 0) {
            console.log(`Processing ${files.length} files`);
            for (const f of files) {
                if (f instanceof File) {
                    console.log(`Processing file: ${f.name}`);
                    const blob = new Blob([await f.arrayBuffer()], { type: f.type });
                    const loader = new WebPDFLoader(blob);
                    const fileDocs = await loader.load();
                    fileDocs.forEach(doc => {
                        doc.metadata.source = f.name;
                        doc.metadata.sourceType = "pdf";
                        doc.metadata.notebookId = notebookId;
                    });
                    docs.push(...fileDocs);
                }
            }
            sourceName = `${files.length} files`;
            sourceType = "pdf";
        }
        // Handle raw text
        else if (text) {
            console.log("Processing raw text");
            docs = [
                new Document({
                    pageContent: text,
                    metadata: {
                        source: "Raw Text",
                        sourceType: "text",
                        notebookId,
                    },
                }),
            ];
            sourceName = "Raw Text";
            sourceType = "text";
        }

        // 2. Split Content (skip for GitHub as it's already chunked by file/lines)
        let splitDocs = docs;
        if (sourceType !== "github") {
            const splitter = new RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            splitDocs = await splitter.splitDocuments(docs);
        }

        console.log(`Total chunks to process: ${splitDocs.length}`);

        // 3. Generate Embeddings
        const apiKey = process.env.GOOGLE_API_KEY;
        if (!apiKey) {
            throw new Error("GOOGLE_API_KEY is missing from environment variables.");
        }
        console.log(`Using Google API Key: ${apiKey.substring(0, 8)}...`);

        const embeddings = new GoogleGenerativeAIEmbeddings({
            modelName: "text-embedding-004",
            taskType: TaskType.RETRIEVAL_DOCUMENT,
            apiKey: apiKey,
        });

        const batchSize = 50; // Reduced batch size for stability
        const pineconeIndex = pinecone.Index(indexName);

        // 4. Batch Upsert to Pinecone
        for (let i = 0; i < splitDocs.length; i += batchSize) {
            const batch = splitDocs.slice(i, i + batchSize);

            console.log(`Generating embeddings for batch ${Math.floor(i / batchSize) + 1} (${batch.length} chunks)...`);
            let batchEmbeddings;
            try {
                batchEmbeddings = await embeddings.embedDocuments(
                    batch.map((d) => d.pageContent)
                );
            } catch (err) {
                console.error("Gemini Embeddings Failed:", err);
                throw err;
            }

            if (!batchEmbeddings || batchEmbeddings.length === 0 || !batchEmbeddings[0] || batchEmbeddings[0].length === 0) {
                throw new Error(`Embedding API returned empty/invalid vectors.`);
            }

            const vectors = batch.map((doc, idx) => ({
                id: `${notebookId}-${Date.now()}-${i + idx}`,
                values: batchEmbeddings[idx],
                metadata: {
                    text: doc.pageContent,
                    source: doc.metadata.source,
                    sourceType: doc.metadata.sourceType || sourceType,
                    page: doc.metadata.page || doc.metadata.loc?.pageNumber || 0,
                    notebookId,
                    // Only include optional fields if they have actual values (Pinecone rejects null)
                    ...(doc.metadata.filePath && { filePath: doc.metadata.filePath }),
                    ...(doc.metadata.lineStart && { lineStart: doc.metadata.lineStart }),
                    ...(doc.metadata.lineEnd && { lineEnd: doc.metadata.lineEnd }),
                    ...(doc.metadata.repoUrl && { repoUrl: doc.metadata.repoUrl }),
                },
            }));

            await pineconeIndex.namespace(notebookId).upsert(vectors);
            console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}`);
        }

        return NextResponse.json({
            success: true,
            chunks: splitDocs.length,
            sourceName,
            sourceType
        });
    } catch (error) {
        console.error("Ingestion error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
