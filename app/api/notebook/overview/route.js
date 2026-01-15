import { NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { Groq } from "groq-sdk";
import pinecone, { indexName } from "@/lib/pinecone";
import { getCachedEmbedding, cacheEmbedding, waitForRateLimit } from "@/lib/api-limiter";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
    try {
        const { notebookId } = await req.json();

        if (!notebookId) {
            return NextResponse.json({ error: "Notebook ID required" }, { status: 400 });
        }

        // 1. Get a sample of vectors from the namespace to understand the content
        const overviewQuery = "summarize the main topics and concepts";
        let queryEmbedding = getCachedEmbedding(overviewQuery);

        if (!queryEmbedding) {
            await waitForRateLimit();
            const embeddings = new GoogleGenerativeAIEmbeddings({
                modelName: "text-embedding-004",
                taskType: TaskType.RETRIEVAL_QUERY,
                apiKey: process.env.GOOGLE_API_KEY,
            });
            queryEmbedding = await embeddings.embedQuery(overviewQuery);
            cacheEmbedding(overviewQuery, queryEmbedding);
        }

        const index = pinecone.Index(indexName);
        const results = await index.namespace(notebookId).query({
            vector: queryEmbedding,
            topK: 10,
            includeMetadata: true,
        });

        if (!results.matches || results.matches.length === 0) {
            return NextResponse.json({
                narrative: {
                    act1: "No content found in this workspace.",
                    act2: "Add some sources (PDFs or GitHub repos) to get started.",
                    act3: "Once you add sources, I'll analyze them and provide insights."
                },
                suggestedQuestions: []
            });
        }

        // 2. Construct context from retrieved chunks (truncate to reduce tokens)
        const chunks = results.matches.map(match => {
            const meta = match.metadata;
            let sourceInfo = `[${meta.sourceType || 'unknown'}] ${meta.source}`;
            if (meta.filePath) sourceInfo += ` - ${meta.filePath}`;
            // Truncate text to reduce token count
            const truncatedText = (meta.text || '').substring(0, 300);
            return `--- ${sourceInfo} ---\n${truncatedText}`;
        }).join("\n\n");

        // 3. Generate synthesis with Groq
        const systemPrompt = `You are an expert research analyst. Analyze the following content samples from a research workspace and provide a structured synthesis.

Your response MUST be valid JSON with this exact structure:
{
    "narrative": {
        "act1": "High-level overview of what this workspace contains (2-3 sentences)",
        "act2": "Key themes, concepts, and patterns you've identified (2-3 sentences)", 
        "act3": "Potential knowledge gaps or areas worth exploring further (2-3 sentences)"
    },
    "suggestedQuestions": [
        "Question 1 that would help explore the content",
        "Question 2 about a specific concept found",
        "Question 3 about connections between topics",
        "Question 4 about practical applications"
    ]
}

Be specific and reference actual topics from the content. Do not be generic.

CONTENT SAMPLES:
${chunks}`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Analyze this workspace and provide the JSON synthesis." }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            max_completion_tokens: 8192,
            top_p: 1,
            stream: false,
        });

        let textResponse = chatCompletion.choices[0]?.message?.content || "";

        // Parse JSON from response
        try {
            // Extract JSON from potential markdown code blocks
            const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                textResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                [null, textResponse];
            const jsonStr = jsonMatch[1] || textResponse;
            const parsed = JSON.parse(jsonStr.trim());

            return NextResponse.json(parsed);
        } catch (parseError) {
            console.error("Failed to parse synthesis JSON:", parseError);
            // Return a fallback structure
            return NextResponse.json({
                narrative: {
                    act1: textResponse.substring(0, 200) + "...",
                    act2: "Analysis generated but couldn't be structured properly.",
                    act3: "Try asking specific questions in the chat."
                },
                suggestedQuestions: [
                    "What are the main topics covered?",
                    "What are the key concepts?",
                    "How do the different sources connect?",
                    "What practical insights can be drawn?"
                ]
            });
        }
    } catch (error) {
        console.error("Overview error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
