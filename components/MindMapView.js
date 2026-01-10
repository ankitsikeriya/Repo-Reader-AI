"use client";

import { useState, useEffect, useCallback } from "react";
import { useNotebook } from "@/lib/context";
import {
    ReactFlow,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    MarkerType
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { RefreshCw, X, Maximize2 } from "lucide-react";
import { clsx } from "clsx";

// Custom node components
const CentralNode = ({ data }) => (
    <div className="px-4 py-2 bg-[#6495ED] text-white rounded-full shadow-lg font-semibold text-sm border-2 border-white">
        {data.label}
    </div>
);

const BranchNode = ({ data }) => (
    <div className="px-3 py-1.5 bg-white border-2 border-[#6495ED] text-[#6495ED] rounded-lg shadow-md font-medium text-xs">
        {data.label}
    </div>
);

const LeafNode = ({ data }) => (
    <div className="px-2 py-1 bg-zinc-100 border border-zinc-300 text-zinc-600 rounded-md text-[10px] shadow-sm">
        {data.label}
    </div>
);

const nodeTypes = {
    central: CentralNode,
    branch: BranchNode,
    leaf: LeafNode
};

const defaultEdgeOptions = {
    style: { stroke: "#94a3b8", strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" }
};

export default function MindMapView({ isOpen, onClose }) {
    const { activeNotebook, activeSources } = useNotebook();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchMindMap = useCallback(async () => {
        if (!activeNotebook || activeSources.length === 0) return;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/notebook/mindmap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notebookId: activeNotebook.id })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to generate mind map");

            setNodes(data.nodes || []);
            setEdges(data.edges || []);
        } catch (err) {
            setError(err.message);
            console.error("Mind map error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [activeNotebook, activeSources.length, setNodes, setEdges]);

    useEffect(() => {
        if (isOpen && activeNotebook && activeSources.length > 0) {
            fetchMindMap();
        }
    }, [isOpen, fetchMindMap]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-[#6495ED]/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#6495ED] rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm">🧠</span>
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-800">Knowledge Mind Map</h3>
                            <p className="text-xs text-zinc-500">Visual overview of your sources</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchMindMap}
                            disabled={isLoading}
                            className="p-2 hover:bg-white/50 rounded-lg text-zinc-500 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/50 rounded-lg text-zinc-500 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Mind Map Canvas */}
                <div className="flex-1 relative">
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white">
                            <div className="text-center">
                                <div className="w-8 h-8 border-2 border-[#6495ED] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                <p className="text-sm text-zinc-500">Generating mind map...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white">
                            <div className="text-center text-red-500">
                                <p className="text-sm mb-2">{error}</p>
                                <button
                                    onClick={fetchMindMap}
                                    className="text-xs bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    ) : (
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            nodeTypes={nodeTypes}
                            defaultEdgeOptions={defaultEdgeOptions}
                            fitView
                            minZoom={0.5}
                            maxZoom={2}
                            className="bg-[#6495ED]/5"
                        >
                            <Background color="#e2e8f0" gap={20} />
                            <Controls className="bg-white rounded-lg shadow-md" />
                        </ReactFlow>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-zinc-100 bg-zinc-50 text-center">
                    <p className="text-xs text-zinc-400">
                        Drag to pan • Scroll to zoom • Click nodes to explore
                    </p>
                </div>
            </div>
        </div>
    );
}
