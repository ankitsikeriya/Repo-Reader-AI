"use client";

import { X, FileText, Github, Code, Copy, Check } from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";

export default function SourceViewerModal({ isOpen, onClose, source }) {
    const [copied, setCopied] = useState(false);
    
    if (!isOpen || !source) return null;

    const isGitHub = source.sourceType === "github" || 
                     source.source?.includes("/") && !source.source?.endsWith(".pdf");
    
    const handleCopy = async () => {
        await navigator.clipboard.writeText(source.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Extract file extension for syntax highlighting hint
    const getLanguage = () => {
        if (!source.filePath && !source.source) return "plaintext";
        const path = source.filePath || source.source;
        const ext = path.split('.').pop()?.toLowerCase();
        const langMap = {
            'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
            'py': 'python', 'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'java': 'java',
            'c': 'c', 'cpp': 'cpp', 'h': 'c', 'hpp': 'cpp', 'cs': 'csharp',
            'html': 'html', 'css': 'css', 'scss': 'scss', 'json': 'json',
            'md': 'markdown', 'yaml': 'yaml', 'yml': 'yaml', 'sql': 'sql',
            'sh': 'bash', 'bash': 'bash', 'zsh': 'bash', 'ps1': 'powershell'
        };
        return langMap[ext] || 'plaintext';
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-zinc-50">
                    <div className="flex items-center gap-3">
                        <div className={clsx(
                            "p-2 rounded-lg",
                            isGitHub ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                        )}>
                            {isGitHub ? <Github size={20} /> : <FileText size={20} />}
                        </div>
                        <div>
                            <h3 className="font-semibold text-zinc-800 text-sm truncate max-w-md">
                                {source.filePath || source.source}
                            </h3>
                            <p className="text-xs text-zinc-500">
                                {isGitHub ? (
                                    <>Lines {source.lineStart || 1}-{source.lineEnd || '?'}</>
                                ) : (
                                    <>Page {source.page}</>
                                )}
                                {source.repoUrl && (
                                    <span className="ml-2 text-purple-500">• {source.repoUrl}</span>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="p-2 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                            title="Copy content"
                        >
                            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            {isGitHub ? "Source Code" : "Original Content"}
                        </h4>
                        {isGitHub && (
                            <span className="text-xs bg-zinc-100 text-zinc-500 px-2 py-1 rounded">
                                {getLanguage()}
                            </span>
                        )}
                    </div>
                    
                    {isGitHub ? (
                        <div className="relative">
                            <pre className="p-4 bg-zinc-900 rounded-lg text-sm leading-relaxed overflow-x-auto">
                                <code className="text-zinc-100 font-mono whitespace-pre">
                                    {source.text?.split('\n').map((line, idx) => (
                                        <div key={idx} className="flex hover:bg-zinc-800/50">
                                            <span className="select-none text-zinc-500 text-right pr-4 min-w-[3rem] border-r border-zinc-700 mr-4">
                                                {(source.lineStart || 1) + idx}
                                            </span>
                                            <span>{line || ' '}</span>
                                        </div>
                                    ))}
                                </code>
                            </pre>
                        </div>
                    ) : (
                        <div className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-lg text-zinc-800 text-sm leading-relaxed font-serif whitespace-pre-wrap selection:bg-yellow-200">
                            {source.text}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
                    <p className="text-xs text-zinc-400">
                        {isGitHub ? "Code from GitHub repository" : "Extracted from PDF document"}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
