
import { NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import pinecone, { indexName } from "@/lib/pinecone";

export async function POST(req) {
    try {
        const { messages, notebookId } = await req.json();

        if (!notebookId) {
            return NextResponse.json({ error: "Notebook ID required" }, { status: 400 });
        }

        const lastMessage = messages[messages.length - 1];
        const query = lastMessage.content;

        // 1. Embed Query
        const embeddings = new GoogleGenerativeAIEmbeddings({
            modelName: "text-embedding-004",
            taskType: TaskType.RETRIEVAL_QUERY,
            apiKey: process.env.GOOGLE_API_KEY,
        });

        const queryEmbedding = await embeddings.embedQuery(query);

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

        // 4. Generate Response
        console.log(`Initializing Gemini Chat with Key: ${process.env.GOOGLE_API_KEY ? "Present" : "Missing"}`);
        const llm = new ChatGoogleGenerativeAI({
            model: "gemini-2.5-flash",
            // model: "gemini-pro", // Fallback
            // apiVersion: "v1beta",
            temperature: 0.3,
            maxRetries: 5,
            apiKey: process.env.GOOGLE_API_KEY,
        });

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

        // Filter history to last few turns to save context window, but here we just pass the last user message + system
        // In a real app we'd summarize history.
        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage(query)
        ]);

        const parser = new StringOutputParser();
        let textObject = await parser.parse(response);

        // Ensure we have a string (some models return objects)
        if (typeof textObject !== 'string') {
            textObject = textObject?.content || textObject?.text || JSON.stringify(textObject);
        }

        return NextResponse.json({
            response: textObject,
            sources: results.matches.map(m => m.metadata)
        }); // simplified non-streaming for MVP Step 1
    } catch (error) {
        console.error("Chat error:", error);

        // Handle 429 specifically
        if (error.message.includes("429") || error.status === 429) {
            return NextResponse.json(
                { error: "Server is busy (rate limit exceeded). Please try again in a few seconds." },
                { status: 429 }
            );
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
