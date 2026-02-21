"use client";

import { MessageSquareText } from "lucide-react";
import { motion } from "framer-motion";

interface SocialBarProps {
  onReaction: (emoji: string) => void;
  onQuickChatOpen: () => void;
}

const REACTIONS = ["🔥", "😂", "👏"];

export function SocialBar({ onReaction, onQuickChatOpen }: SocialBarProps) {
  return (
    <div className="glass-card fixed bottom-3 left-1/2 z-40 flex w-[calc(100%-1.25rem)] max-w-lg -translate-x-1/2 items-center justify-between rounded-2xl px-3 py-2">
      <div className="flex items-center gap-2">
        {REACTIONS.map((emoji) => (
          <motion.button
            key={emoji}
            type="button"
            onClick={() => onReaction(emoji)}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.86 }}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-lg"
          >
            {emoji}
          </motion.button>
        ))}
      </div>

      <button
        type="button"
        onClick={onQuickChatOpen}
        className="neon-button inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white"
      >
        <MessageSquareText className="h-4 w-4" />
        Quick Chat
      </button>
    </div>
  );
}
