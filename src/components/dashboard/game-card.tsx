"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Brush,
  Clock3,
  Flag,
  Languages,
  MoveRight,
  ShieldAlert,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { GameCardConfig } from "@/lib/game-catalog";

const gameIcons: Record<GameCardConfig["id"], LucideIcon> = {
  "sketch-and-guess": Brush,
  "stop-human-animal-object": Flag,
  spyfall: ShieldAlert,
  "most-likely-to": Users,
  "truth-or-dare": Target,
  "emoji-translator": Languages,
  "the-spy": ShieldAlert,
  "five-second-rule": Clock3,
};

interface GameCardProps {
  game: GameCardConfig;
}

export function GameCard({ game }: GameCardProps) {
  const Icon = gameIcons[game.id];

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card relative overflow-hidden rounded-3xl p-5"
    >
      <div
        className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${game.accentClass}`}
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-white/10 p-2 text-white">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-white">{game.title}</h3>
            <p className="text-xs text-violet-100/80">{game.subtitle}</p>
          </div>
        </div>

        <span
          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            game.status === "live"
              ? "bg-emerald-400/20 text-emerald-200"
              : "bg-amber-400/20 text-amber-200"
          }`}
        >
          {game.status === "live" ? "Playable" : "Planned"}
        </span>
      </div>

      <p className="mb-5 min-h-16 text-sm leading-relaxed text-slate-200/90">
        {game.description}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
          <Link
            href={`/lobby?game=${game.id}&mode=create`}
            className="neon-button rounded-xl bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900"
          >
            Create Room
          </Link>
        </motion.div>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}>
          <Link
            href={`/lobby?game=${game.id}&mode=join`}
            className="neon-button rounded-xl border border-white/25 px-3 py-2 text-center text-sm font-semibold text-white"
          >
            Join Room
          </Link>
        </motion.div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-300">
        <MoveRight className="h-3.5 w-3.5" />
        Real-time rooms, synced timers, and shared scoring.
      </div>
    </motion.article>
  );
}
