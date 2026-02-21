"use client";

import { useState } from "react";
import { BrainCircuit, PlayCircle, Send } from "lucide-react";
import { getSocket } from "@/lib/socket-client";
import type { PlayerState, RoomState } from "@/types/realtime";

interface EmojiTranslatorGameProps {
  room: RoomState;
  me: PlayerState | null;
  isHost: boolean;
}

export function EmojiTranslatorGame({ room, me, isHost }: EmojiTranslatorGameProps) {
  const emojiGame = room.emojiTranslator;
  const [guess, setGuess] = useState("");
  const solvedPlayer = room.players.find((player) => player.id === emojiGame.solvedByPlayerId);

  return (
    <div className="space-y-4">
      <section className="glass-card rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
              Emoji Translator · Round {emojiGame.round}
            </p>
            <h3 className="text-lg font-semibold text-white">
              {emojiGame.phase === "lobby" && "Start a puzzle"}
              {emojiGame.phase === "guessing" && "Decode the emoji phrase"}
              {emojiGame.phase === "results" && "Puzzle solved"}
            </h3>
            {emojiGame.phase === "guessing" && (
              <p className="text-sm text-slate-300">Timer: {emojiGame.timeLeft}s</p>
            )}
          </div>

          {isHost && (emojiGame.phase === "lobby" || emojiGame.phase === "results") && (
            <button
              type="button"
              onClick={() => getSocket().emit("emoji:start-round")}
              className="neon-button inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900"
            >
              <PlayCircle className="h-4 w-4" />
              New Puzzle
            </button>
          )}
        </div>
      </section>

      <section className="glass-card rounded-2xl p-4 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
          Emoji Sequence
        </p>
        <p className="text-4xl leading-tight">{emojiGame.emoji || "🎬❓"}</p>
        <p className="mt-2 text-xs text-slate-300">
          Answer length: {emojiGame.answerLength > 0 ? emojiGame.answerLength : "-"}
        </p>
      </section>

      {emojiGame.phase === "guessing" && (
        <section className="glass-card rounded-2xl p-4">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
            <BrainCircuit className="h-4 w-4 text-emerald-300" />
            Fast Typing Guess
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const value = guess.trim();
                  if (!value) {
                    return;
                  }
                  getSocket().emit("emoji:guess", { text: value });
                  setGuess("");
                }
              }}
              placeholder="Type your answer..."
              className="w-full rounded-xl border border-white/20 bg-slate-900/70 px-3 py-2 text-sm text-white"
            />
            <button
              type="button"
              onClick={() => {
                const value = guess.trim();
                if (!value) {
                  return;
                }
                getSocket().emit("emoji:guess", { text: value });
                setGuess("");
              }}
              className="neon-button rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {emojiGame.phase === "results" && (
        <section className="glass-card rounded-2xl p-4">
          <p className="text-sm text-slate-300">Solved by</p>
          <p className="text-lg font-semibold text-white">
            {solvedPlayer?.name ?? "No one"}
            {solvedPlayer?.id === me?.id ? " (You)" : ""}
          </p>
          <p className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-cyan-100">
            Answer: {emojiGame.revealAnswer ?? "Unknown"}
          </p>
        </section>
      )}
    </div>
  );
}
