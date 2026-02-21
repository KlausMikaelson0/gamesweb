"use client";

import { motion } from "framer-motion";

interface GlobalTimerBarProps {
  label: string;
  remaining: number;
  duration: number;
}

export function GlobalTimerBar({ label, remaining, duration }: GlobalTimerBarProps) {
  const safeDuration = Math.max(1, duration);
  const percentage = Math.max(0, Math.min(100, (remaining / safeDuration) * 100));

  return (
    <section className="glass-card overflow-hidden rounded-xl p-2">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-200">
        <span className="font-semibold uppercase tracking-wide">{label}</span>
        <span className="font-mono">{remaining}s</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          animate={{ width: `${percentage}%` }}
          transition={{ ease: "linear", duration: 0.35 }}
          className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.55)]"
        />
      </div>
    </section>
  );
}
