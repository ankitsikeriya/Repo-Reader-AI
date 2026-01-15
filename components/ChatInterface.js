"use client";

import { useState, useRef, useEffect } from "react";
import { useNotebook } from "@/lib/context";
import { Send, User, Bot, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { clsx } from "clsx";
import SourceViewerModal from "./SourceViewerModal";
import NotebookOverview from "./NotebookOverview";

export default function ChatInterface() {
    const { activeNotebook } = useNotebook();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [viewingSource, setViewingSource] = useState(null); // Metadata of the source being viewed
    const scrollRef = useRef(null);

    useEffect(() => {
        setMessages([]);
    }, [activeNotebook?.id]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { role: "user", content: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMsg],
                    notebookId: activeNotebook.id,
                }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to fetch response");

            const botMsg = {
                role: "assistant",
                content: data.response,
                sources: data.sources
            };
            setMessages((prev) => [...prev, botMsg]);
        } catch (err) {
            console.error(err);
            // Handle rate limit errors specifically
            if (err.message.includes("429") || err.message.includes("rate limit") || err.message.includes("busy")) {
                setMessages((prev) => [...prev, {
                    role: "assistant",
                    content: "⏳ **Rate limit reached.** The API is cooling down. Please wait 15-30 seconds before trying again."
                }]);
            } else {
                setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCitationClick = (filename, page, sources) => {
        // Find the matching source chunk. 
        // The citation is [Source: filename, Page X]. 
        // We look for a source in `sources` that matches filename and page.
        const match = sources?.find(s => s.source === filename && String(s.page) === String(page));
        if (match) {
            setViewingSource(match);
        } else {
            console.warn("Source not found for citation:", filename, page);
            // Fallback if we can't find exact chunk? Just show metadata.
            setViewingSource({ source: filename, page, text: "Specific text chunk not found in context metadata." });
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F0F0F0] relative">
            <SourceViewerModal
                isOpen={!!viewingSource}
                onClose={() => setViewingSource(null)}
                source={viewingSource}
            />

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth"
            >
                {/* Workspace Insights - always visible when sources exist */}
                <div className="max-w-3xl mx-auto">
                    <NotebookOverview onQuestionClick={(q) => setInput(q)} />
                </div>

                {messages.length === 0 && (
                    <div className="max-w-3xl mx-auto">
                        <div className="text-center py-10 opacity-50 animate-in fade-in zoom-in duration-500">
                            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Bot size={32} className="text-zinc-400" />
                            </div>
                            <p>Start chatting with your notebook.</p>
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={clsx(
                            "flex gap-4 max-w-3xl mx-auto group",
                            msg.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                    >
                        <div
                            className={clsx(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 shadow-sm transition-transform group-hover:scale-105",
                                msg.role === "user" ? "bg-zinc-200" : "bg-[#6495ED] text-white"
                            )}
                        >
                            {msg.role === "user" ? <User size={16} /> : <div className="font-bold text-[10px]">AI</div>}
                        </div>

                        <div
                            className={clsx(
                                "p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-colors",
                                msg.role === "user"
                                    ? "bg-zinc-100 text-zinc-800 rounded-tr-sm hover:bg-zinc-200/80"
                                    : "bg-white border border-zinc-100 text-zinc-700 rounded-tl-sm w-full hover:border-zinc-200"
                            )}
                        >
                            {msg.role === "user" ? (
                                msg.content
                            ) : (
                                <MarkdownWithCitations
                                    content={msg.content}
                                    sources={msg.sources}
                                    onCitationClick={handleCitationClick}
                                />
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-4 max-w-3xl mx-auto animate-in fade-in duration-300">
                        <div className="w-8 h-8 rounded-full bg-[#6495ED] flex items-center justify-center flex-shrink-0 mt-1">
                            <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
                        </div>
                        <div className="p-4 bg-white border border-zinc-100 rounded-2xl rounded-tl-sm shadow-sm w-32">
                            <div className="flex gap-1 h-full items-center pl-2">
                                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce delay-75" />
                                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce delay-150" />
                                <div className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce delay-300" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-white border-t border-zinc-100 relative z-10">
                <div className="max-w-3xl mx-auto relative">
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            placeholder="Ask a question about your sources..."
                            className="w-full pl-5 pr-12 py-4 bg-zinc-50 border border-zinc-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all shadow-sm text-zinc-800 placeholder:text-zinc-400"
                            value={input}
                            disabled={isLoading}
                            onChange={(e) => setInput(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all transform active:scale-95"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

function MarkdownWithCitations({ content, sources, onCitationClick }) {
    // Regex to match [Source: filename, Page X] or [Source: repo/path, Page LX-LY]
    const parts = content.split(/(\[Source: .*?, Page [^\]]+\])/g);

    return (
        <div className="markdown-body">
            {parts.map((part, index) => {
                const match = part.match(/\[Source: (.*?), Page ([^\]]+)\]/);

                if (match) {
                    const [_, filename, page] = match;

                    // Detect if this is a GitHub source (contains "/" and line numbers like L1-L50)
                    const isGitHub = filename.includes("/") && !filename.endsWith(".pdf");

                    // Find the matching source for metadata
                    const matchingSource = sources?.find(s =>
                        s.source === filename ||
                        s.filePath === filename ||
                        s.source?.includes(filename)
                    );

                    return (
                        <span
                            key={index}
                            onClick={() => onCitationClick(filename, page, sources)}
                            className={clsx(
                                "inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-all select-none transform hover:scale-[1.02]",
                                isGitHub
                                    ? "bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 hover:border-purple-200"
                                    : "bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 hover:border-blue-200"
                            )}
                            title={`Click to view: ${filename}`}
                        >
                            {isGitHub ? (
                                <span className="text-[8px]">📁</span>
                            ) : (
                                <FileText size={10} />
                            )}
                            <span className="truncate max-w-[80px]">
                                {isGitHub ? filename.split('/').pop() : `p.${page}`}
                            </span>
                        </span>
                    );
                }

                // Render regular markdown for non-citation parts
                return <ReactMarkdown key={index} components={{ p: "span" }}>{part}</ReactMarkdown>;
            })}
        </div>
    );
}
