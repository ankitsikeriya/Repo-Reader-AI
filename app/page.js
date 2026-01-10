"use client";

import LayoutWrapper from "@/components/LayoutWrapper";
import ChatInterface from "@/components/ChatInterface";
import { NotebookProvider, useNotebook } from "@/lib/context";

function MainContent() {
  const { activeNotebook } = useNotebook();

  if (!activeNotebook) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#F0F0F0] text-zinc-500 p-8 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mb-6">
          <div className="w-8 h-8 rounded-lg bg-[#6495ED]" />
        </div>
        <h2 className="text-2xl font-semibold text-zinc-800 mb-2">Welcome to your Notebooks</h2>
        <p className="max-w-md text-zinc-400">
          Select a notebook from the sidebar or create a new one to get started.
          Upload your documents and start chatting with your knowledge base.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-[#F0F0F0]/80 backdrop-blur-sm border-b border-zinc-100 z-10">
        <h2 className="text-xl font-semibold text-zinc-800">{activeNotebook.name}</h2>
        <div className="text-xs px-2 py-1 bg-zinc-100 text-zinc-500 rounded-md uppercase tracking-wider font-medium">
          Reporeader AI
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <ChatInterface />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <NotebookProvider>
      <LayoutWrapper>
        <MainContent />
      </LayoutWrapper>
    </NotebookProvider>
  );
}
