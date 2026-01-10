import { NextResponse } from "next/server";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import pinecone, { indexName } from "@/lib/pinecone";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
    try {
        const { notebookId } = await req.json();

        if (!notebookId) {
            return NextResponse.json({ error: "Notebook ID required" }, { status: 400 });
        }

        // 1. Get a sample of vectors from the namespace to understand the content
        const embeddings = new GoogleGenerativeAIEmbeddings({
            modelName: "text-embedding-004",
            taskType: TaskType.RETRIEVAL_QUERY,
            apiKey: process.env.GOOGLE_API_KEY,
        });

        // Use a general query to retrieve diverse content
        const queryEmbedding = await embeddings.embedQuery("summarize the main topics and concepts");

        const index = pinecone.Index(indexName);
        const results = await index.namespace(notebookId).query({
            vector: queryEmbedding,
            topK: 20,
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

        // 2. Construct context from retrieved chunks
        const chunks = results.matches.map(match => {
            const meta = match.metadata;
            let sourceInfo = `[${meta.sourceType || 'unknown'}] ${meta.source}`;
            if (meta.filePath) sourceInfo += ` - ${meta.filePath}`;
            if (meta.page) sourceInfo += ` (${meta.page})`;
            return `--- ${sourceInfo} ---\n${meta.text}`;
        }).join("\n\n");

        // 3. Generate synthesis with Gemini
        const llm = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash",
            maxRetries: 5,
            apiKey: process.env.GOOGLE_API_KEY,
        });

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

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage("Analyze this workspace and provide the JSON synthesis.")
        ]);

        const parser = new StringOutputParser();
        let textResponse = await parser.parse(response);

        // Ensure string
        if (typeof textResponse !== 'string') {
            textResponse = textResponse?.content || textResponse?.text || JSON.stringify(textResponse);
        }

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
