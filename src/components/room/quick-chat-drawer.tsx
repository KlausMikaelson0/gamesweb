"use client";

import { motion } from "framer-motion";
import { MessageSquareText, X } from "lucide-react";

interface QuickChatDrawerProps {
  open: boolean;
  onClose: () => void;
  onSend: (phrase: string) => void;
}

const QUICK_PHRASES = [
  "I'm the winner!",
  "Hurry up!",
  "No way!",
  "That was lucky.",
  "I need a rematch.",
  "Focus, team!",
];

export function QuickChatDrawer({ open, onClose, onSend }: QuickChatDrawerProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ x: open ? 0 : 320 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="fixed right-3 top-20 z-50 w-[88vw] max-w-xs"
    >
      <div className="glass-card rounded-2xl p-3">
        <header className="mb-3 flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <MessageSquareText className="h-4 w-4 text-cyan-300" />
            Quick Chat
          </p>
          <button
            type="button"
            onClick={onClose}
            className="neon-button rounded-lg border border-white/20 p-1 text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="grid gap-2">
          {QUICK_PHRASES.map((phrase) => (
            <button
              key={phrase}
              type="button"
              onClick={() => onSend(phrase)}
              className="neon-button rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-left text-sm text-white"
            >
              {phrase}
            </button>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}
