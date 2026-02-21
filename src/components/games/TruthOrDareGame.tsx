"use client";

import { motion } from "framer-motion";
import { CirclePlay, Sparkles } from "lucide-react";
import { getSocket } from "@/lib/socket-client";
import type { PlayerState, RoomState } from "@/types/realtime";

interface TruthOrDareGameProps {
  room: RoomState;
  me: PlayerState | null;
  isHost: boolean;
}

export function TruthOrDareGame({ room, me, isHost }: TruthOrDareGameProps) {
  const truthDare = room.truthOrDare;
  const selectedPlayer = room.players.find((player) => player.id === truthDare.selectedPlayerId);

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-200">
              Truth or Dare · Round {truthDare.round}
            </p>
            <h3 className="text-lg font-semibold text-white">
              {truthDare.phase === "lobby" && "Spin the wheel to begin"}
              {truthDare.phase === "spinning" && "Wheel spinning..."}
              {truthDare.phase === "prompt" && "Challenge selected"}
            </h3>
          </div>

          {isHost && (
            <button
              type="button"
              onClick={() => getSocket().emit("truthdare:spin")}
              className="neon-button inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-3 py-2 text-sm font-semibold text-white"
            >
              <CirclePlay className="h-4 w-4" />
              Spin Wheel
            </button>
          )}
        </div>
      </section>

      <section className="glass-card rounded-2xl p-4">
        <div className="relative mx-auto aspect-square max-w-sm">
          <motion.div
            animate={{ rotate: truthDare.spinAngle }}
            transition={{ duration: truthDare.phase === "spinning" ? 3.2 : 0.2, ease: "easeOut" }}
            className="h-full w-full rounded-full border border-white/20 bg-[conic-gradient(from_0deg,_rgba(139,92,246,0.65),_rgba(6,182,212,0.65),_rgba(236,72,153,0.65),_rgba(139,92,246,0.65))] p-3 shadow-[0_0_55px_rgba(139,92,246,0.38)]"
          >
            <div className="flex h-full w-full items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-center">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-300">3D Neon Wheel</p>
                <p className="text-xl font-black text-white">Truth or Dare</p>
              </div>
            </div>
          </motion.div>
          <div className="absolute -top-2 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[15px] border-x-transparent border-t-cyan-300" />
        </div>
      </section>

      {truthDare.phase === "prompt" && (
        <section className="glass-card rounded-2xl p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Selected player
          </p>
          <p className="text-lg font-semibold text-white">
            {selectedPlayer?.name ?? "Unknown"}
            {selectedPlayer?.id === me?.id ? " (You)" : ""}
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" />
            {truthDare.mode}
          </p>
          <p className="mt-2 rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white">
            {truthDare.prompt || "Spin to reveal prompt"}
          </p>
        </section>
      )}
    </div>
  );
}
