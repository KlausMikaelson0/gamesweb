"use client";

import { motion } from "framer-motion";

interface ConfettiOverlayProps {
  active: boolean;
}

export function ConfettiOverlay({ active }: ConfettiOverlayProps) {
  if (!active) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 80 }).map((_, index) => (
        <motion.span
          key={index}
          initial={{
            x: `${(index * 37) % 100}vw`,
            y: -20,
            opacity: 0,
            rotate: 0,
          }}
          animate={{
            y: "110vh",
            opacity: [0, 1, 1, 0],
            rotate: 460 + (index % 2 ? 180 : -180),
          }}
          transition={{
            duration: 3 + ((index * 7) % 5) * 0.3,
            ease: "easeOut",
          }}
          className={`absolute h-2.5 w-2.5 rounded-sm ${
            index % 3 === 0
              ? "bg-violet-400"
              : index % 3 === 1
                ? "bg-cyan-400"
                : "bg-fuchsia-400"
          }`}
        />
      ))}
    </div>
  );
}
