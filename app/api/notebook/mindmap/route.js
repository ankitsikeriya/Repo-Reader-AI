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

        // Query for diverse content samples (with caching)
        const mindmapQuery = "main concepts topics structure";
        let queryEmbedding = getCachedEmbedding(mindmapQuery);

        if (!queryEmbedding) {
            await waitForRateLimit();
            const embeddings = new GoogleGenerativeAIEmbeddings({
                modelName: "text-embedding-004",
                taskType: TaskType.RETRIEVAL_QUERY,
                apiKey: process.env.GOOGLE_API_KEY,
            });
            queryEmbedding = await embeddings.embedQuery(mindmapQuery);
            cacheEmbedding(mindmapQuery, queryEmbedding);
        }

        const index = pinecone.Index(indexName);
        const results = await index.namespace(notebookId).query({
            vector: queryEmbedding,
            topK: 15,
            includeMetadata: true,
        });

        if (!results.matches || results.matches.length === 0) {
            return NextResponse.json({
                nodes: [{ id: "0", type: "central", data: { label: "No sources yet" }, position: { x: 250, y: 200 } }],
                edges: []
            });
        }

        // Build context from chunks (truncate to reduce tokens)
        const chunks = results.matches.map(m => ({
            text: m.metadata.text?.substring(0, 250),
            source: m.metadata.source,
            sourceType: m.metadata.sourceType || "unknown",
            filePath: m.metadata.filePath
        }));

        const context = chunks.map(c =>
            `[${c.sourceType}] ${c.filePath || c.source}: ${c.text}`
        ).join("\n\n");

        // Generate mind map structure with Groq
        const systemPrompt = `Analyze the following content and create a mind map structure.

Return ONLY valid JSON with this structure:
{
    "central": "Main Topic Name",
    "branches": [
        {
            "name": "Branch 1 Name",
            "children": ["Sub-topic 1", "Sub-topic 2", "Sub-topic 3"]
        },
        {
            "name": "Branch 2 Name", 
            "children": ["Sub-topic 1", "Sub-topic 2"]
        }
    ]
}

Rules:
- Create 3-6 main branches representing key themes
- Each branch should have 2-4 specific children
- Use concise labels (2-4 words each)
- Be specific based on actual content, not generic

CONTENT:
${context}`;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Create the mind map JSON structure." }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.7,
            max_completion_tokens: 8192,
            top_p: 1,
            stream: false,
        });

        let textResponse = chatCompletion.choices[0]?.message?.content || "";

        // Parse JSON from response
        let mindmapData;
        try {
            const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/) ||
                textResponse.match(/```\s*([\s\S]*?)\s*```/) ||
                [null, textResponse];
            const jsonStr = jsonMatch[1] || textResponse;
            mindmapData = JSON.parse(jsonStr.trim());
        } catch (e) {
            console.error("Failed to parse mindmap JSON:", e);
            mindmapData = {
                central: "Workspace",
                branches: [{ name: "Sources", children: ["PDF Documents", "GitHub Repos"] }]
            };
        }

        // Convert to React Flow nodes and edges
        const { nodes, edges } = convertToFlowData(mindmapData);

        return NextResponse.json({ nodes, edges });
    } catch (error) {
        console.error("Mindmap error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function convertToFlowData(data) {
    const nodes = [];
    const edges = [];

    // Central node
    nodes.push({
        id: "central",
        type: "central",
        data: { label: data.central || "Workspace" },
        position: { x: 400, y: 250 }
    });

    // Branch nodes
    const branchCount = data.branches?.length || 0;
    const angleStep = (2 * Math.PI) / Math.max(branchCount, 1);
    const branchRadius = 180;

    data.branches?.forEach((branch, branchIdx) => {
        const angle = angleStep * branchIdx - Math.PI / 2;
        const branchX = 400 + Math.cos(angle) * branchRadius;
        const branchY = 250 + Math.sin(angle) * branchRadius;

        const branchId = `branch-${branchIdx}`;

        nodes.push({
            id: branchId,
            type: "branch",
            data: { label: branch.name },
            position: { x: branchX, y: branchY }
        });

        edges.push({
            id: `e-central-${branchId}`,
            source: "central",
            target: branchId,
            type: "smoothstep"
        });

        // Child nodes
        const childCount = branch.children?.length || 0;
        const childRadius = 100;
        const childAngleSpread = Math.PI / 3;
        const childStartAngle = angle - childAngleSpread / 2;
        const childAngleStep = childCount > 1 ? childAngleSpread / (childCount - 1) : 0;

        branch.children?.forEach((child, childIdx) => {
            const childAngle = childCount === 1 ? angle : childStartAngle + childAngleStep * childIdx;
            const childX = branchX + Math.cos(childAngle) * childRadius;
            const childY = branchY + Math.sin(childAngle) * childRadius;

            const childId = `child-${branchIdx}-${childIdx}`;

            nodes.push({
                id: childId,
                type: "leaf",
                data: { label: child },
                position: { x: childX, y: childY }
            });

            edges.push({
                id: `e-${branchId}-${childId}`,
                source: branchId,
                target: childId,
                type: "smoothstep"
            });
        });
    });

    return { nodes, edges };
}
