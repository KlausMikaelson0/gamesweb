"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  PlayCircle,
  RefreshCw,
  Timer,
  Trophy,
  UsersRound,
} from "lucide-react";
import { ChatPanel } from "@/components/room/chat-panel";
import { PlayerList } from "@/components/room/player-list";
import { SketchBoard } from "@/components/sketch/sketch-board";
import { GAME_LIBRARY } from "@/lib/game-catalog";
import { sanitizeRoomCode } from "@/lib/room-code";
import { getSocket } from "@/lib/socket-client";
import { playLoseSound, playWinSound } from "@/lib/sounds";
import type { DrawSegment, GameId, RoomStatePayload } from "@/types/realtime";

const gameIds = new Set<GameId>(Object.keys(GAME_LIBRARY) as GameId[]);

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const hasAttemptedCreateRef = useRef(false);
  const meIdRef = useRef<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "offline"
  >("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [roomPayload, setRoomPayload] = useState<RoomStatePayload | null>(null);
  const [drawSegments, setDrawSegments] = useState<DrawSegment[]>([]);
  const [chatDraft, setChatDraft] = useState("");

  const requestedCode = sanitizeRoomCode(params.code);
  const requestedMode = searchParams.get("mode") === "create" ? "create" : "join";
  const requestedName = (searchParams.get("name") ?? "").trim();
  const requestedGame = searchParams.get("game") as GameId | null;
  const gameId: GameId =
    requestedGame && gameIds.has(requestedGame) ? requestedGame : "sketch-and-guess";
  const game = GAME_LIBRARY[gameId];

  const roomState = roomPayload?.room ?? null;
  const me = roomPayload?.me ?? null;
  const isHost = Boolean(me?.isHost);
  const isSketch = roomState?.game === "sketch-and-guess";
  const isDrawer = Boolean(isSketch && me && roomState?.sketch.drawerId === me.id);
  const canDraw = Boolean(isDrawer && roomState?.sketch.phase === "drawing");
  const scoreLeader = useMemo(
    () =>
      roomState?.players.reduce((top, player) => (player.score > top.score ? player : top), {
        id: "",
        name: "-",
        score: 0,
        isHost: false,
      }),
    [roomState],
  );

  useEffect(() => {
    meIdRef.current = me?.id ?? null;
  }, [me?.id]);

  useEffect(() => {
    if (!requestedName) {
      router.replace(`/lobby?game=${gameId}&mode=${requestedMode}`);
      return;
    }

    const socket = getSocket();

    const onConnect = () => {
      setConnectionStatus("connected");
      setErrorMessage("");
      const payload = {
        code: requestedCode,
        game: gameId,
        name: requestedName,
      };

      if (requestedMode === "create" && !hasAttemptedCreateRef.current) {
        hasAttemptedCreateRef.current = true;
        socket.emit("room:create", { ...payload, requestedCode });
      } else {
        socket.emit("room:join", payload);
      }
    };

    const onDisconnect = () => {
      setConnectionStatus("offline");
    };

    const onRoomState = (payload: RoomStatePayload) => {
      setRoomPayload(payload);
      setDrawSegments(payload.room.sketch.drawingSegments);
      if (payload.room.code !== requestedCode) {
        router.replace(
          `/room/${payload.room.code}?mode=join&game=${payload.room.game}&name=${encodeURIComponent(requestedName)}`,
        );
      }
    };

    const onRoomError = (payload: { message: string }) => {
      setErrorMessage(payload.message);
    };

    const onDrawSegment = (segment: DrawSegment) => {
      setDrawSegments((current) => [...current, segment]);
    };

    const onRoundEnded = (payload: { reason: string; winnerId?: string }) => {
      if (payload.reason === "guessed" && payload.winnerId === meIdRef.current) {
        playWinSound();
        return;
      }
      if (payload.reason === "timeout") {
        playLoseSound();
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    socket.on("sketch:draw", onDrawSegment);
    socket.on("sketch:round-ended", onRoundEnded);

    if (!socket.connected) {
      socket.connect();
    } else {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onRoomState);
      socket.off("room:error", onRoomError);
      socket.off("sketch:draw", onDrawSegment);
      socket.off("sketch:round-ended", onRoundEnded);
      socket.emit("room:leave");
    };
  }, [gameId, requestedCode, requestedMode, requestedName, router]);

  const sendChat = () => {
    const message = chatDraft.trim();
    if (!message) {
      return;
    }
    const socket = getSocket();
    if (isSketch) {
      socket.emit("sketch:guess", { text: message });
    } else {
      socket.emit("room:chat", { text: message });
    }
    setChatDraft("");
  };

  const startRound = () => {
    getSocket().emit("sketch:start-round");
  };

  const clearCanvas = () => {
    getSocket().emit("sketch:clear");
  };

  return (
    <div className="min-h-screen bg-slate-950 px-3 py-4 text-slate-100 sm:px-5 sm:py-6">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <header className="rounded-2xl border border-white/15 bg-slate-900/70 p-4 shadow-xl shadow-violet-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-xs text-slate-300 transition hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Exit to dashboard
              </Link>
              <h1 className="text-xl font-bold text-white sm:text-2xl">{game.title}</h1>
              <p className="text-sm text-slate-300">
                Room{" "}
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(roomState?.code ?? requestedCode);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 font-mono text-xs uppercase tracking-widest text-violet-100 hover:bg-white/20"
                >
                  {roomState?.code ?? requestedCode}
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5">
                <UsersRound className="h-4 w-4" />
                {roomState?.players.length ?? 0} players
              </span>
              <span className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5">
                <Trophy className="h-4 w-4 text-amber-200" />
                Leader: {scoreLeader?.name} ({scoreLeader?.score ?? 0})
              </span>
              {isSketch && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5">
                  <Timer className="h-4 w-4" />
                  {roomState?.sketch.timeLeft ?? 0}s
                </span>
              )}
            </div>
          </div>
        </header>

        {connectionStatus !== "connected" && (
          <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-300">
            {connectionStatus === "connecting"
              ? "Connecting to room server..."
              : "Connection lost. Reconnecting..."}
          </p>
        )}

        {errorMessage && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-rose-300/30 bg-rose-500/20 px-3 py-2 text-sm text-rose-100"
          >
            {errorMessage}
          </motion.p>
        )}

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <section className="space-y-4 rounded-2xl border border-white/15 bg-slate-900/60 p-4">
            {isSketch ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-3 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold text-white">
                      Round {roomState?.sketch.round ?? 0} ·{" "}
                      {roomState?.sketch.phase === "drawing" ? "Live" : "Lobby"}
                    </p>
                    <p className="text-slate-300">
                      {isDrawer
                        ? `Your prompt: ${roomState?.sketch.currentWord ?? "Waiting..."}`
                        : `Prompt: ${roomState?.sketch.maskedWord ?? "-----"}`}
                    </p>
                  </div>

                  {isHost && (
                    <button
                      type="button"
                      onClick={startRound}
                      className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400"
                    >
                      {roomState?.sketch.phase === "drawing" ? (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Restart Round
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4" />
                          Start Round
                        </>
                      )}
                    </button>
                  )}
                </div>

                <SketchBoard
                  segments={drawSegments}
                  canDraw={canDraw}
                  onClear={clearCanvas}
                  onSegment={(segment) => {
                    getSocket().emit("sketch:draw", segment);
                  }}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center text-slate-300">
                <p className="text-lg font-semibold text-white">{game.title}</p>
                <p className="mt-2">
                  This room system is ready. Game logic for this title is scaffolded and coming in
                  the next phase.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-white/15 bg-slate-950/60 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                {isSketch ? "Guess in chat" : "Room chat"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatDraft}
                  placeholder={isDrawer ? "Guessers are typing..." : "Type your guess"}
                  onChange={(event) => setChatDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendChat();
                    }
                  }}
                  className="flex-1 rounded-xl border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-300"
                />
                <button
                  type="button"
                  onClick={sendChat}
                  className="rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Send
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <PlayerList
              players={roomState?.players ?? []}
              currentPlayerId={me?.id}
              drawerId={roomState?.sketch.drawerId}
            />
            <ChatPanel messages={roomState?.chat ?? []} />
          </aside>
        </div>
      </main>
    </div>
  );
}
