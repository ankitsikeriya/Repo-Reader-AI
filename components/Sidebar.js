"use client";

import { useState } from "react";
import { useNotebook } from "@/lib/context";
import { Plus, Book } from "lucide-react";
import { clsx } from "clsx";

export default function Sidebar() {
    const { notebooks, activeNotebookId, switchNotebook, createNotebook } = useNotebook();
    const [isCreating, setIsCreating] = useState(false);
    const [newNotebookName, setNewNotebookName] = useState("");

    const handleCreate = (e) => {
        e.preventDefault();
        if (newNotebookName.trim()) {
            createNotebook(newNotebookName);
            setNewNotebookName("");
            setIsCreating(false);
        }
    };

    return (
        <div className="w-64 bg-zinc-50 border-r border-zinc-200 h-screen flex flex-col pt-4 pb-4">
            <div className="px-4 mb-6">
                <h1 className="text-xl font-semibold text-zinc-800 flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#6495ED] rounded-lg flex items-center justify-center text-white font-bold">
                        R
                    </div>
                    Reporeader AI
                </h1>
            </div>

            <div className="px-3 mb-2">
                <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-zinc-200 shadow-sm rounded-lg hover:bg-zinc-50 transition-colors text-zinc-700 font-medium"
                >
                    <Plus size={18} />
                    New Notebook
                </button>
            </div>

            {isCreating && (
                <div className="px-3 mb-2">
                    <form onSubmit={handleCreate} className="p-2 bg-white border border-blue-200 rounded-lg shadow-sm">
                        <input
                            type="text"
                            autoFocus
                            placeholder="Notebook name..."
                            className="w-full text-sm outline-none text-zinc-800 placeholder:text-zinc-400"
                            value={newNotebookName}
                            onChange={(e) => setNewNotebookName(e.target.value)}
                            onBlur={() => !newNotebookName && setIsCreating(false)}
                        />
                    </form>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 space-y-1 mt-2">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider px-3 mb-2">
                    Your Notebooks
                </div>
                {notebooks.length === 0 && (
                    <div className="text-sm text-zinc-400 px-3 italic">
                        No notebooks yet.
                    </div>
                )}
                {notebooks.map((notebook) => (
                    <button
                        key={notebook.id}
                        onClick={() => switchNotebook(notebook.id)}
                        className={clsx(
                            "w-full flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg transition-colors text-left",
                            activeNotebookId === notebook.id
                                ? "bg-[#6495ED]/10 text-[#6495ED] font-medium"
                                : "text-zinc-600 hover:bg-zinc-100"
                        )}
                    >
                        <Book size={16} className={activeNotebookId === notebook.id ? "text-[#6495ED]" : "text-zinc-400"} />
                        <span className="truncate">{notebook.name}</span>
                    </button>
                ))}
            </div>

            <div className="px-4 py-4 border-t border-zinc-200">
                <div className="text-xs text-zinc-400">
                    Current Workspace
                </div>
            </div>
        </div>
    );
}
