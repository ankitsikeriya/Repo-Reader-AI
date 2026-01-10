"use client";

import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [isDark, setIsDark] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const saved = localStorage.getItem("theme");
        const dark = saved === "dark";
        setIsDark(dark);
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    }, []);

    const toggleTheme = () => {
        const newValue = !isDark;
        setIsDark(newValue);
        localStorage.setItem("theme", newValue ? "dark" : "light");
        document.documentElement.setAttribute("data-theme", newValue ? "dark" : "light");
    };

    if (!mounted) {
        return <>{children}</>;
    }

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        return { isDark: false, toggleTheme: () => { } };
    }
    return context;
}
