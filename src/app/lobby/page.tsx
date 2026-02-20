"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, DoorOpen, PlusSquare, UsersRound } from "lucide-react";
import { GAME_LIBRARY } from "@/lib/game-catalog";
import { generateRoomCode, isRoomCodeValid, sanitizeRoomCode } from "@/lib/room-code";
import type { GameId } from "@/types/realtime";

const GAME_IDS = new Set<GameId>(Object.keys(GAME_LIBRARY) as GameId[]);

export default function LobbyPage() {
  return (
    <Suspense fallback={<LobbyLoadingState />}>
      <LobbyContent />
    </Suspense>
  );
}

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const gameId = useMemo(() => {
    const requestedGame = searchParams.get("game") as GameId | null;
    if (requestedGame && GAME_IDS.has(requestedGame)) {
      return requestedGame;
    }
    return "sketch-and-guess";
  }, [searchParams]);

  const game = GAME_LIBRARY[gameId];
  const [mode, setMode] = useState<"create" | "join">(
    searchParams.get("mode") === "join" ? "join" : "create",
  );

  const submit = () => {
    const trimmedName = playerName.trim();
    if (trimmedName.length < 2) {
      setErrorMessage("Pick a nickname with at least 2 characters.");
      return;
    }

    if (mode === "create") {
      const requestedCode = generateRoomCode();
      router.push(
        `/room/${requestedCode}?mode=create&game=${gameId}&name=${encodeURIComponent(trimmedName)}`,
      );
      return;
    }

    const cleanCode = sanitizeRoomCode(roomCode);
    if (!isRoomCodeValid(cleanCode)) {
      setErrorMessage("Room code must be 4 to 6 letters or numbers.");
      return;
    }

    router.push(
      `/room/${cleanCode}?mode=join&game=${gameId}&name=${encodeURIComponent(trimmedName)}`,
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto w-full max-w-lg space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-3xl border border-white/15 bg-slate-900/70 p-6 shadow-2xl shadow-violet-950/40"
        >
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-white">{game.title}</h1>
            <p className="text-sm text-slate-300">{game.description}</p>
          </header>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === "create" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
              }`}
            >
              <PlusSquare className="h-4 w-4" />
              Create Room
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                mode === "join" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
              }`}
            >
              <DoorOpen className="h-4 w-4" />
              Join Room
            </button>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-semibold text-slate-200">Nickname</span>
            <input
              type="text"
              value={playerName}
              onChange={(event) => {
                setPlayerName(event.target.value);
                setErrorMessage("");
              }}
              placeholder="Captain Guesser"
              className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white outline-none ring-0 transition focus:border-violet-300"
            />
          </label>

          {mode === "join" && (
            <label className="block space-y-1 text-sm">
              <span className="font-semibold text-slate-200">Room Code</span>
              <input
                type="text"
                value={roomCode}
                maxLength={6}
                onChange={(event) => {
                  setRoomCode(sanitizeRoomCode(event.target.value));
                  setErrorMessage("");
                }}
                placeholder="AB12C"
                className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 font-mono uppercase tracking-widest text-white outline-none transition focus:border-violet-300"
              />
            </label>
          )}

          <button
            type="button"
            onClick={submit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
          >
            <UsersRound className="h-4 w-4" />
            {mode === "create" ? "Create & Enter Room" : "Join Room"}
          </button>

          {errorMessage && (
            <p className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-3 py-2 text-sm text-rose-100">
              {errorMessage}
            </p>
          )}
        </motion.section>
      </div>
    </div>
  );
}

function LobbyLoadingState() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900/70 p-6">
        <p className="text-sm text-slate-300">Loading lobby...</p>
      </div>
    </div>
  );
}
