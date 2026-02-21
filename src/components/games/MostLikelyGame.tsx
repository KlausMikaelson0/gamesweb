"use client";

import { motion } from "framer-motion";
import { BarChart3, PlayCircle, Vote } from "lucide-react";
import { getSocket } from "@/lib/socket-client";
import type { PlayerState, RoomState } from "@/types/realtime";

interface MostLikelyGameProps {
  room: RoomState;
  me: PlayerState | null;
  isHost: boolean;
}

export function MostLikelyGame({ room, me, isHost }: MostLikelyGameProps) {
  const mostLikely = room.mostLikely;
  const maxVotes = Math.max(1, ...mostLikely.votes.map((entry) => entry.votes));

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">
              Most Likely To · Round {mostLikely.round}
            </p>
            <h3 className="text-lg font-semibold text-white">
              {mostLikely.question || "Host picks the next question"}
            </h3>
            {(mostLikely.phase === "voting" || mostLikely.phase === "results") && (
              <p className="text-sm text-slate-300">Timer: {mostLikely.timeLeft}s</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isHost && (mostLikely.phase === "lobby" || mostLikely.phase === "results") && (
              <button
                type="button"
                onClick={() => getSocket().emit("mostlikely:start-round")}
                className="neon-button inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-900"
              >
                <PlayCircle className="h-4 w-4" />
                New Prompt
              </button>
            )}
            {isHost && mostLikely.phase === "voting" && (
              <button
                type="button"
                onClick={() => getSocket().emit("mostlikely:finalize")}
                className="neon-button inline-flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold text-white"
              >
                <Vote className="h-4 w-4" />
                Finalize
              </button>
            )}
          </div>
        </div>
      </section>

      {mostLikely.phase === "voting" && (
        <section className="glass-card rounded-2xl p-4">
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
            Tap a player to vote
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {room.players.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => getSocket().emit("mostlikely:vote", { targetPlayerId: player.id })}
                className={`neon-button rounded-xl border p-3 text-center ${
                  mostLikely.myVoteTargetId === player.id
                    ? "border-cyan-300/70 bg-cyan-400/25"
                    : "border-white/20 bg-white/5"
                }`}
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white">
                  {player.name.slice(0, 1).toUpperCase()}
                </div>
                <p className="text-sm font-semibold text-white">
                  {player.name}
                  {player.id === me?.id ? " (You)" : ""}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {(mostLikely.phase === "results" || mostLikely.phase === "voting") && (
        <section className="glass-card rounded-2xl p-4">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
            <BarChart3 className="h-4 w-4 text-violet-300" />
            Live vote chart
          </p>
          <div className="space-y-2">
            {mostLikely.votes.map((entry) => {
              const player = room.players.find((candidate) => candidate.id === entry.playerId);
              const width = `${(entry.votes / maxVotes) * 100}%`;
              const isWinner = mostLikely.winnerPlayerId === entry.playerId;
              return (
                <div
                  key={entry.playerId}
                  className={`rounded-xl border p-2 ${
                    isWinner ? "neon-glow border-cyan-300/50 bg-cyan-400/15" : "border-white/10 bg-white/5"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between text-sm text-white">
                    <span>{player?.name ?? "Unknown"}</span>
                    <span>{entry.votes}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <motion.div
                      animate={{ width }}
                      transition={{ duration: 0.35 }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
