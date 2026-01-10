"use client";

import { useState } from "react";
import { useNotebook } from "@/lib/context";
import { FileText, Plus, X, Upload, ChevronRight, ChevronLeft, Github, Link2 } from "lucide-react";
import { clsx } from "clsx";

export default function SourcesPanel({ isOpen, togglePanel }) {
    const { activeSources, addSource, activeNotebook } = useNotebook();
    const [isInjecting, setIsInjecting] = useState(false);
    const [injectingMessage, setInjectingMessage] = useState("Processing...");
    const [showGithubModal, setShowGithubModal] = useState(false);
    const [githubUrl, setGithubUrl] = useState("");

    if (!activeNotebook) return null;

    const handleFileUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        try {
            setIsInjecting(true);
            setInjectingMessage(`Processing ${files.length} file(s)...`);

            const formData = new FormData();
            for (const file of files) {
                formData.append("files", file);
            }
            formData.append("notebookId", activeNotebook.id);

            const res = await fetch("/api/ingest", {
                method: "POST",
                body: formData
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Upload failed");

            // Add each file as a source
            for (const file of files) {
                addSource(activeNotebook.id, {
                    name: file.name,
                    type: "pdf",
                    sourceType: "pdf",
                    size: Math.round(file.size / 1024) + " KB",
                    chunks: Math.round(data.chunks / files.length)
                });
            }

            alert(`Successfully processed ${files.length} file(s) (${data.chunks} chunks)`);
        } catch (err) {
            alert("Error uploading source: " + err.message);
            console.error(err);
        } finally {
            setIsInjecting(false);
            e.target.value = null;
        }
    };

    const handleGithubSubmit = async () => {
        if (!githubUrl.trim()) return;

        try {
            setShowGithubModal(false);
            setIsInjecting(true);
            setInjectingMessage("Cloning repository...");

            const formData = new FormData();
            formData.append("githubUrl", githubUrl.trim());
            formData.append("notebookId", activeNotebook.id);

            const res = await fetch("/api/ingest", {
                method: "POST",
                body: formData
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "GitHub ingestion failed");

            addSource(activeNotebook.id, {
                name: githubUrl.split('/').slice(-2).join('/'),
                type: "github",
                sourceType: "github",
                url: githubUrl,
                chunks: data.chunks
            });

            setGithubUrl("");
            alert(`Successfully ingested GitHub repo (${data.chunks} code chunks)`);
        } catch (err) {
            alert("Error ingesting GitHub repo: " + err.message);
            console.error(err);
        } finally {
            setIsInjecting(false);
        }
    };

    const getSourceIcon = (source) => {
        if (source.sourceType === "github" || source.type === "github") {
            return <Github size={16} />;
        }
        return <FileText size={16} />;
    };

    const getSourceColor = (source) => {
        if (source.sourceType === "github" || source.type === "github") {
            return "text-purple-500 bg-purple-50";
        }
        return "text-red-500 bg-red-50";
    };

    return (
        <div
            className={clsx(
                "border-l border-zinc-200 bg-white h-screen transition-all duration-300 ease-in-out flex flex-col relative",
                isOpen ? "w-80" : "w-0 overflow-hidden"
            )}
        >
            <div className="flex items-center justify-between p-4 border-b border-zinc-100">
                <h2 className="font-semibold text-zinc-800">Sources</h2>
                <button onClick={togglePanel} className="p-1 hover:bg-zinc-100 rounded-md text-zinc-500">
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Add Source Buttons */}
                <div className="grid grid-cols-2 gap-2">
                    {/* PDF Upload */}
                    <button
                        className="flex flex-col items-center justify-center gap-2 p-4 border border-dashed border-zinc-300 rounded-xl text-zinc-500 hover:bg-zinc-50 hover:border-zinc-400 transition-all group"
                        onClick={() => document.getElementById('source-upload-trigger')?.click()}
                    >
                        <div className="w-8 h-8 bg-red-50 rounded-full flex items-center justify-center group-hover:bg-red-100 border border-red-100">
                            <FileText size={16} className="text-red-500" />
                        </div>
                        <span className="text-xs font-medium">Add PDF</span>
                    </button>
                    <input
                        type="file"
                        id="source-upload-trigger"
                        className="hidden"
                        accept=".pdf"
                        multiple
                        onChange={handleFileUpload}
                    />

                    {/* GitHub Repo */}
                    <button
                        className="flex flex-col items-center justify-center gap-2 p-4 border border-dashed border-zinc-300 rounded-xl text-zinc-500 hover:bg-zinc-50 hover:border-zinc-400 transition-all group"
                        onClick={() => setShowGithubModal(true)}
                    >
                        <div className="w-8 h-8 bg-purple-50 rounded-full flex items-center justify-center group-hover:bg-purple-100 border border-purple-100">
                            <Github size={16} className="text-purple-500" />
                        </div>
                        <span className="text-xs font-medium">Add Repo</span>
                    </button>
                </div>

                {/* Source List */}
                <div className="space-y-2">
                    {activeSources.length === 0 ? (
                        <div className="text-center py-8 text-zinc-400 text-sm">
                            No sources added yet.<br />Upload PDFs or add a GitHub repo.
                        </div>
                    ) : (
                        activeSources.map((source, idx) => (
                            <div key={idx} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-100 hover:border-zinc-200 transition-colors cursor-pointer group">
                                <div className={clsx("mt-0.5 p-1.5 rounded-md", getSourceColor(source))}>
                                    {getSourceIcon(source)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-medium text-zinc-800 truncate">{source.name}</h3>
                                    <p className="text-xs text-zinc-500">
                                        {source.sourceType || source.type} • {source.chunks || 0} chunks
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50">
                <p className="text-xs text-zinc-400 text-center">
                    {activeSources.length} sources used for answers
                </p>
            </div>

            {/* Processing Overlay */}
            {isInjecting && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
                    <div className="bg-white p-4 rounded-lg shadow-lg border border-zinc-200 flex flex-col items-center gap-3">
                        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-medium text-zinc-700">{injectingMessage}</span>
                    </div>
                </div>
            )}

            {/* GitHub URL Modal */}
            {showGithubModal && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-30">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-72 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-zinc-800">Add GitHub Repo</h3>
                            <button onClick={() => setShowGithubModal(false)} className="text-zinc-400 hover:text-zinc-600">
                                <X size={18} />
                            </button>
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Repository URL</label>
                            <input
                                type="url"
                                placeholder="https://github.com/user/repo"
                                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGithubSubmit()}
                            />
                        </div>
                        <button
                            onClick={handleGithubSubmit}
                            disabled={!githubUrl.trim()}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Add Repository
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export function SourcesToggle({ onClick, isOpen }) {
    if (isOpen) return null;
    return (
        <button
            onClick={onClick}
            className="absolute right-4 top-4 p-2 bg-white border border-zinc-200 shadow-sm rounded-lg hover:bg-zinc-50 text-zinc-600 z-10"
        >
            <ChevronLeft size={20} />
        </button>
    )
}
