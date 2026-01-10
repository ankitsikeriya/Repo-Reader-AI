"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import SourcesPanel, { SourcesToggle } from "./SourcesPanel";
import { useNotebook } from "@/lib/context";
import MouseFollower from "./MouseFollower";

export default function LayoutWrapper({ children }) {
    const [isSourcesOpen, setIsSourcesOpen] = useState(true);
    const { activeNotebook } = useNotebook();

    return (
        <div className="flex h-screen bg-[#F0F0F0] overflow-hidden font-sans">
            <MouseFollower />
            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative w-full h-full">
                {/* Toggle for Sources (only if closed) */}
                {activeNotebook && <SourcesToggle isOpen={isSourcesOpen} onClick={() => setIsSourcesOpen(true)} />}

                <main className="flex-1 overflow-hidden relative">
                    {children}
                </main>
            </div>

            {/* Right Panel */}
            {activeNotebook && (
                <SourcesPanel isOpen={isSourcesOpen} togglePanel={() => setIsSourcesOpen(false)} />
            )}
        </div>
    );
}
