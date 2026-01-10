"use client";

import { useState, useEffect } from "react";

export default function MouseFollower() {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            setPosition({ x: e.clientX, y: e.clientY });
            setIsVisible(true);
        };

        const handleMouseLeave = () => {
            setIsVisible(false);
        };

        window.addEventListener("mousemove", handleMouseMove);
        document.body.addEventListener("mouseleave", handleMouseLeave);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            document.body.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, []);

    if (!isVisible) return null;

    return (
        <div
            className="fixed pointer-events-none z-[9999] transition-transform duration-65 ease-out"
            style={{
                left: position.x,
                top: position.y,
                transform: "translate(-50%, -50%)"
            }}
        >
            <div className="w-3 h-3 bg-[#6495ED] rounded-full opacity-60 shadow-lg shadow-[#6495ED]/30" />
        </div>
    );
}
