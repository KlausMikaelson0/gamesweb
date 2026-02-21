"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Eye, PlayCircle, ShieldAlert, Vote } from "lucide-react";
import { getSocket } from "@/lib/socket-client";
import type { PlayerState, RoomState } from "@/types/realtime";

interface SpyfallGameProps {
  room: RoomState;
  me: PlayerState | null;
  isHost: boolean;
}

export function SpyfallGame({ room, me, isHost }: SpyfallGameProps) {
  const [revealed, setRevealed] = useState(false);
  const spyfall = room.spyfall;

  useEffect(() => {
    setRevealed(false);
  }, [spyfall.round]);

  const myVote = spyfall.myVoteTargetId;

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-200">
              Spyfall Round {spyfall.round}
            </p>
            <h3 className="text-lg font-semibold text-white">
              {spyfall.phase === "lobby" && "Waiting for host to start"}
              {spyfall.phase === "reveal" && "Reveal your secret card"}
              {spyfall.phase === "discussion" && "Interrogation phase is live"}
              {spyfall.phase === "voting" && "Vote for the suspected spy"}
              {spyfall.phase === "results" && "Round verdict"}
            </h3>
            {(spyfall.phase === "discussion" || spyfall.phase === "voting") && (
              <p className="text-sm text-slate-300">Timer: {spyfall.timeLeft}s</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isHost && (spyfall.phase === "lobby" || spyfall.phase === "results") && (
              <button
                type="button"
                onClick={() => getSocket().emit("spyfall:start-round")}
                className="neon-button inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white"
              >
                <PlayCircle className="h-4 w-4" />
                Start Mission
              </button>
            )}
            {isHost && spyfall.phase === "discussion" && (
              <button
                type="button"
                onClick={() => getSocket().emit("spyfall:start-voting")}
                className="neon-button inline-flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold text-white"
              >
                <Vote className="h-4 w-4" />
                Move to Voting
              </button>
            )}
            {isHost && spyfall.phase === "voting" && (
              <button
                type="button"
                onClick={() => getSocket().emit("spyfall:finalize-voting")}
                className="neon-button inline-flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold text-white"
              >
                <ShieldAlert className="h-4 w-4" />
                Finalize Vote
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-4">
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
          Reveal Card
        </h4>
        <motion.button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="relative h-44 w-full overflow-hidden rounded-2xl border border-white/20 bg-slate-900/60"
        >
          <motion.div
            animate={{ rotateY: revealed ? 180 : 0 }}
            transition={{ duration: 0.55 }}
            style={{ transformStyle: "preserve-3d" }}
            className="relative h-full w-full"
          >
            <div className="absolute inset-0 flex items-center justify-center gap-2" style={{ backfaceVisibility: "hidden" }}>
              <Eye className="h-5 w-5 text-cyan-300" />
              <span className="text-sm font-semibold text-white">Tap to reveal</span>
            </div>
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
              style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
            >
              <p className="text-xs uppercase tracking-wide text-slate-300">Your role</p>
              <p className="text-xl font-bold text-white">
                {spyfall.myRole === "spy" ? "SPY" : "CITIZEN"}
              </p>
              <p className="text-sm text-cyan-100">
                {spyfall.myRole === "spy" ? "Location: ???" : `Location: ${spyfall.myLocation ?? "?"}`}
              </p>
            </div>
          </motion.div>
        </motion.button>
      </section>

      {spyfall.phase === "voting" && (
        <section className="glass-card rounded-2xl p-4">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Vote for the Spy
          </h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {room.players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => getSocket().emit("spyfall:vote", { targetPlayerId: player.id })}
                className={`neon-button rounded-xl border px-3 py-2 text-left ${
                  myVote === player.id
                    ? "border-rose-300/60 bg-rose-500/30 text-white"
                    : "border-white/20 bg-white/5 text-white"
                }`}
              >
                {player.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {spyfall.phase === "results" && (
        <section className="glass-card rounded-2xl p-4">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Vote Breakdown
          </h4>
          <div className="space-y-2">
            {spyfall.votes.map((entry) => {
              const player = room.players.find((candidate) => candidate.id === entry.playerId);
              return (
                <div key={entry.playerId} className="rounded-xl border border-white/10 bg-white/5 p-2">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-white">{player?.name ?? "Unknown"}</span>
                    <span className="font-semibold text-cyan-100">{entry.votes}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, entry.votes * 16)}%` }}
                      className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {spyfall.spyIdRevealed && (
            <p className="mt-3 text-sm text-amber-100">
              Spy was:{" "}
              <strong>{room.players.find((player) => player.id === spyfall.spyIdRevealed)?.name}</strong>
            </p>
          )}
          {spyfall.locationRevealed && (
            <p className="text-sm text-slate-200">Location: {spyfall.locationRevealed}</p>
          )}
        </section>
      )}
    </div>
  );
}
