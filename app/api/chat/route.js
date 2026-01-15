
import { NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { Groq } from "groq-sdk";
import pinecone, { indexName } from "@/lib/pinecone";
import { getCachedEmbedding, cacheEmbedding, waitForRateLimit } from "@/lib/api-limiter";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req) {
    try {
        const { messages, notebookId } = await req.json();

        if (!notebookId) {
            return NextResponse.json({ error: "Notebook ID required" }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1];
        const query = lastMessage.content;

        // 1. Embed Query (with caching to reduce API calls)
        let queryEmbedding = getCachedEmbedding(query);

        if (!queryEmbedding) {
            // Wait for rate limit before making API call
            await waitForRateLimit();

            const embeddings = new GoogleGenerativeAIEmbeddings({
                modelName: "text-embedding-004",
                taskType: TaskType.RETRIEVAL_QUERY,
                apiKey: process.env.GOOGLE_API_KEY,
            });

            queryEmbedding = await embeddings.embedQuery(query);
            cacheEmbedding(query, queryEmbedding);
        }

        // 2. Query Pinecone
        const index = pinecone.Index(indexName);
        const results = await index.namespace(notebookId).query({
            vector: queryEmbedding,
            topK: 7,
            includeMetadata: true,
        });

        // 3. Construct Context
        const context = results.matches
            .map(match => `[Source: ${match.metadata.source}, Page ${match.metadata.page}]\n${match.metadata.text}`)
            .join("\n\n---\n\n");

        if (!context) {
            return NextResponse.json({
                response: "I don't have enough information in this notebook to answer that question. Please upload some relevant documents."
            });
        }

        // 4. Generate Response with Groq
        const systemPrompt = `You are a helpful assistant for a specific notebook.
You answer questions ONLY using the provided Context.
If the answer is NOT in the Context, say "I don't know based on the provided sources."

CITATION RULES:
- You MUST rely on the context to answer.
- Every assertion should be backed by a citation.
- Format inline citations EXACTLY like this: [Source: filename.pdf, Page 3].
- Do not cite the "Context" generally, cite the specific source file and page provided.
- Use markdown for formatting.

CONTEXT:
${context}`;

        console.log(`Initializing Groq Chat with Key: ${process.env.GROQ_API_KEY ? "Present" : "Missing"}`);

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: query }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_completion_tokens: 8192,
            top_p: 1,
            stream: false,
        });

        const textResponse = chatCompletion.choices[0]?.message?.content || "";

        return NextResponse.json({
            response: textResponse,
            sources: results.matches.map(m => m.metadata)
        });
    } catch (error) {
        console.error("Chat error:", error);

        // Handle 429 specifically
        if (error.message?.includes("429") || error.status === 429) {
            return NextResponse.json(
                { error: "Server is busy (rate limit exceeded). Please try again in a few seconds." },
                { status: 429 }
            );
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
