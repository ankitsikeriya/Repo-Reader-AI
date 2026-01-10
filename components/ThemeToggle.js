"use client";

import { useTheme } from "@/lib/themeContext";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg border shadow-sm transition-all hover:scale-105"
            style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-color)"
            }}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
            {isDark ? (
                <Sun size={18} className="text-yellow-500" />
            ) : (
                <Moon size={18} className="text-zinc-600" />
            )}
        </button>
    );
}
