"use client";

import { useEffect, useState } from "react";

const COLORS = [
  "#d6ff3d", 
  "#0a0a0a", 
  "#ffffff", 
  "#ffd9b3", 
  "#c8e6ff", 
  "#e4d4ff"
];
const PIECE_COUNT = 70;

export function Confetti() {
  const [pieces, setPieces] = useState<React.ReactNode[]>([]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const generated = Array.from({ length: PIECE_COUNT }, (_, i) => {
        const left = Math.random() * 100;
        const dx = (Math.random() - 0.5) * 240;
        const rot = (Math.random() * 6 - 3) * 360 + "deg";
        const duration = 1.6 + Math.random() * 1.4;
        const delay = Math.random() * 0.2;
        const color = COLORS[i % COLORS.length];
        const w = 6 + Math.random() * 8;
        const h = 8 + Math.random() * 12;
        return (
          <span
            key={i}
            className="absolute -top-5 animate-fall rounded-xs will-change-[transform,opacity]"
            style={
              {
                left: left + "%",
                background: color,
                width: w,
                height: h,
                "--dx": dx + "px",
                "--rot": rot,
                animationDuration: duration + "s",
                animationDelay: delay + "s",
              } as React.CSSProperties
            }
          />
        );
      });

      setPieces(generated);
    });

    return () => cancelAnimationFrame(raf);
  }, []);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-210 overflow-hidden">
      {pieces}
    </div>
  );
}
