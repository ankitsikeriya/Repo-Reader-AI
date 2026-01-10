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

        // Query for diverse content samples
        const embeddings = new GoogleGenerativeAIEmbeddings({
            modelName: "text-embedding-004",
            taskType: TaskType.RETRIEVAL_QUERY,
            apiKey: process.env.GOOGLE_API_KEY,
        });

        const queryEmbedding = await embeddings.embedQuery("main concepts topics structure");

        const index = pinecone.Index(indexName);
        const results = await index.namespace(notebookId).query({
            vector: queryEmbedding,
            topK: 30,
            includeMetadata: true,
        });

        if (!results.matches || results.matches.length === 0) {
            return NextResponse.json({
                nodes: [{ id: "0", type: "central", data: { label: "No sources yet" }, position: { x: 250, y: 200 } }],
                edges: []
            });
        }

        // Build context from chunks
        const chunks = results.matches.map(m => ({
            text: m.metadata.text?.substring(0, 500),
            source: m.metadata.source,
            sourceType: m.metadata.sourceType || "unknown",
            filePath: m.metadata.filePath
        }));

        const context = chunks.map(c =>
            `[${c.sourceType}] ${c.filePath || c.source}: ${c.text}`
        ).join("\n\n");

        // Generate mind map structure with Gemini
        const llm = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash",
            maxRetries: 5,
            apiKey: process.env.GOOGLE_API_KEY,
        });

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

        const response = await llm.invoke([
            new SystemMessage(systemPrompt),
            new HumanMessage("Create the mind map JSON structure.")
        ]);

        const parser = new StringOutputParser();
        let textResponse = await parser.parse(response);

        if (typeof textResponse !== 'string') {
            textResponse = textResponse?.content || textResponse?.text || JSON.stringify(textResponse);
        }

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
