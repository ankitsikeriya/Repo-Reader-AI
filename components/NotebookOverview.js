"use client";

import { useState, useEffect, useRef } from "react";
import { useNotebook } from "@/lib/context";
import { Sparkles, MessageCircle, RefreshCw, ChevronDown, ChevronUp, Network } from "lucide-react";
import { clsx } from "clsx";
import MindMapView from "./MindMapView";

// Simple local cache for overview data (persists across re-renders)
const overviewCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function NotebookOverview({ onQuestionClick }) {
    const { activeNotebook, activeSources } = useNotebook();
    const [overview, setOverview] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isExpanded, setIsExpanded] = useState(true);
    const [showMindMap, setShowMindMap] = useState(false);
    const lastFetchRef = useRef(0);

    const fetchOverview = async (force = false) => {
        if (!activeNotebook || activeSources.length === 0) return;

        // Check cache first (unless force refresh)
        const cacheKey = `${activeNotebook.id}-${activeSources.length}`;
        const cached = overviewCache.get(cacheKey);
        if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL) {
            console.log("[Overview] Using cached data");
            setOverview(cached.data);
            return;
        }

        // Debounce: prevent fetching more than once every 3 seconds
        const now = Date.now();
        if (!force && now - lastFetchRef.current < 3000) {
            console.log("[Overview] Debounced - too soon since last fetch");
            return;
        }
        lastFetchRef.current = now;

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/notebook/overview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notebookId: activeNotebook.id })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to generate overview");

            setOverview(data);
            // Cache the result
            overviewCache.set(cacheKey, { data, timestamp: Date.now() });
        } catch (err) {
            setError(err.message);
            console.error("Overview error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeNotebook && activeSources.length > 0) {
            // Check cache before auto-fetching
            const cacheKey = `${activeNotebook.id}-${activeSources.length}`;
            const cached = overviewCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
                setOverview(cached.data);
            } else {
                fetchOverview();
            }
        } else {
            setOverview(null);
        }
    }, [activeNotebook?.id, activeSources.length]);

    if (!activeNotebook || activeSources.length === 0) {
        return null;
    }

    return (
        <>
            <MindMapView isOpen={showMindMap} onClose={() => setShowMindMap(false)} />

            <div className="bg-[#6495ED]/10 border border-[#6495ED]/20 rounded-2xl p-4 mb-4 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#6495ED] rounded-lg flex items-center justify-center">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <h3 className="font-semibold text-zinc-800">Workspace Insights</h3>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Mind Map Button */}
                        <button
                            onClick={() => setShowMindMap(true)}
                            className="p-1.5 hover:bg-white/50 rounded-md text-purple-500 transition-colors"
                            title="View Mind Map"
                        >
                            <Network size={14} />
                        </button>
                        <button
                            onClick={() => fetchOverview(true)}
                            disabled={isLoading}
                            className="p-1.5 hover:bg-white/50 rounded-md text-zinc-500 transition-colors"
                            title="Refresh insights"
                        >
                            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1.5 hover:bg-white/50 rounded-md text-zinc-500 transition-colors"
                        >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <>
                        {isLoading ? (
                            <div className="text-center py-6">
                                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <p className="text-sm text-zinc-500">Analyzing your sources...</p>
                            </div>
                        ) : error ? (
                            <div className="text-center py-4 text-red-500 text-sm">
                                {error}
                            </div>
                        ) : overview ? (
                            <div className="space-y-4">
                                {/* Mind Map Quick Access */}
                                <button
                                    onClick={() => setShowMindMap(true)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#6495ED] text-white rounded-lg text-sm font-medium hover:bg-[#4a7dd4] transition-all shadow-md hover:shadow-lg"
                                >
                                    <Network size={16} />
                                    View Knowledge Mind Map
                                </button>

                                {/* Narrative */}
                                <div className="space-y-2">
                                    {overview.narrative.act1 && (
                                        <div className="bg-white/60 rounded-lg p-3">
                                            <p className="text-xs font-medium text-blue-600 mb-1">Overview</p>
                                            <p className="text-sm text-zinc-700">{overview.narrative.act1}</p>
                                        </div>
                                    )}
                                    {overview.narrative.act2 && (
                                        <div className="bg-white/60 rounded-lg p-3">
                                            <p className="text-xs font-medium text-purple-600 mb-1">Key Themes</p>
                                            <p className="text-sm text-zinc-700">{overview.narrative.act2}</p>
                                        </div>
                                    )}
                                    {overview.narrative.act3 && (
                                        <div className="bg-white/60 rounded-lg p-3">
                                            <p className="text-xs font-medium text-emerald-600 mb-1">Explore Further</p>
                                            <p className="text-sm text-zinc-700">{overview.narrative.act3}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Suggested Questions */}
                                {overview.suggestedQuestions && overview.suggestedQuestions.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-zinc-500 mb-2 flex items-center gap-1">
                                            <MessageCircle size={12} />
                                            Suggested Questions
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {overview.suggestedQuestions.map((q, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => onQuestionClick && onQuestionClick(q)}
                                                    className="text-xs bg-white hover:bg-blue-50 border border-zinc-200 hover:border-blue-300 rounded-full px-3 py-1.5 text-zinc-700 hover:text-blue-700 transition-all"
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </>
    );
}
