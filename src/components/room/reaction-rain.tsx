"use client";

import { motion } from "framer-motion";
import type { ReactionEvent } from "@/types/realtime";

interface ReactionRainProps {
  reactions: ReactionEvent[];
}

export function ReactionRain({ reactions }: ReactionRainProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {reactions.map((reaction, index) => (
        <motion.div
          key={reaction.id}
          initial={{ opacity: 0, y: 70, x: `${(index * 17) % 80}vw`, scale: 0.7 }}
          animate={{ opacity: [0, 1, 1, 0], y: -320, x: `${((index * 29) % 80) + 8}vw`, scale: 1.15 }}
          transition={{ duration: 2.2, ease: "easeOut" }}
          className="absolute bottom-10 text-3xl drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]"
        >
          {reaction.emoji}
        </motion.div>
      ))}
    </div>
  );
}
