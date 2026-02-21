"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Copy,
  Gamepad2,
  MessageCircleMore,
  PlayCircle,
  RefreshCw,
  Timer,
  Trophy,
  UsersRound,
} from "lucide-react";
import { ChatPanel } from "@/components/room/chat-panel";
import { ConfettiOverlay } from "@/components/room/confetti-overlay";
import { EmojiTranslatorGame } from "@/components/games/EmojiTranslatorGame";
import { GlobalTimerBar } from "@/components/room/global-timer-bar";
import { MostLikelyGame } from "@/components/games/MostLikelyGame";
import { PlayerList } from "@/components/room/player-list";
import { QuickChatDrawer } from "@/components/room/quick-chat-drawer";
import { ReactionRain } from "@/components/room/reaction-rain";
import { SocialBar } from "@/components/room/social-bar";
import { SpyfallGame } from "@/components/games/SpyfallGame";
import { StopGame } from "@/components/games/StopGame";
import { SketchBoard } from "@/components/sketch/sketch-board";
import { TruthOrDareGame } from "@/components/games/TruthOrDareGame";
import { GAME_LIBRARY } from "@/lib/game-catalog";
import { sanitizeRoomCode } from "@/lib/room-code";
import { getSocket } from "@/lib/socket-client";
import {
  playClickSound,
  playLoseSound,
  playSuccessSound,
  playTimeWarningSound,
  playWinSound,
} from "@/lib/sounds";
import type {
  CurrentGame,
  DrawSegment,
  GameId,
  ReactionEvent,
  RoomStatePayload,
} from "@/types/realtime";

const gameIds = new Set<GameId>(Object.keys(GAME_LIBRARY) as GameId[]);
const SWITCHABLE_GAMES: Array<{ value: CurrentGame; label: string }> = [
  { value: "SKETCH", label: "Sketch & Guess" },
  { value: "STOP", label: "STOP" },
  { value: "SPYFALL", label: "Spyfall" },
  { value: "MOST_LIKELY", label: "Most Likely To" },
  { value: "TRUTH_OR_DARE", label: "Truth or Dare" },
  { value: "EMOJI_TRANSLATOR", label: "Emoji Translator" },
];

export default function RoomPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const hasAttemptedCreateRef = useRef(false);
  const meIdRef = useRef<string | null>(null);
  const warningMarkerRef = useRef<string>("");
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "offline"
  >("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [roomPayload, setRoomPayload] = useState<RoomStatePayload | null>(null);
  const [drawSegments, setDrawSegments] = useState<DrawSegment[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [quickChatOpen, setQuickChatOpen] = useState(false);
  const [reactionEvents, setReactionEvents] = useState<ReactionEvent[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [leaderboardGlow, setLeaderboardGlow] = useState(false);

  const requestedCode = sanitizeRoomCode(params.code);
  const requestedMode = searchParams.get("mode") === "create" ? "create" : "join";
  const requestedName = (searchParams.get("name") ?? "").trim();
  const requestedGame = searchParams.get("game") as GameId | null;
  const gameId: GameId =
    requestedGame && gameIds.has(requestedGame) ? requestedGame : "sketch-and-guess";

  const roomState = roomPayload?.room ?? null;
  const me = roomPayload?.me ?? null;
  const isHost = Boolean(me?.isHost);
  const currentGame = roomState?.current_game ?? mapGameIdToCurrentGame(gameId);
  const isSketch = currentGame === "SKETCH";
  const isStop = currentGame === "STOP";
  const isDrawer = Boolean(isSketch && me && roomState?.sketch.drawerId === me.id);
  const canDraw = Boolean(isDrawer && roomState?.sketch.phase === "drawing");
  const activeGameTitle = getCurrentGameTitle(currentGame);
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

  const activeTimer = useMemo(() => {
    if (!roomState) {
      return null;
    }
    if (currentGame === "SKETCH" && roomState.sketch.phase === "drawing") {
      return { label: "Sketch Timer", remaining: roomState.sketch.timeLeft, duration: 60 };
    }
    if (currentGame === "STOP") {
      if (roomState.stop.phase === "countdown") {
        return { label: "STOP Countdown", remaining: roomState.stop.timeLeft, duration: 5 };
      }
      if (roomState.stop.phase === "voting") {
        return { label: "STOP Voting", remaining: roomState.stop.timeLeft, duration: 20 };
      }
    }
    if (currentGame === "SPYFALL" && roomState.spyfall.timeLeft > 0) {
      const duration =
        roomState.spyfall.phase === "discussion"
          ? 300
          : roomState.spyfall.phase === "voting"
            ? 45
            : 15;
      return { label: "Spyfall", remaining: roomState.spyfall.timeLeft, duration };
    }
    if (currentGame === "MOST_LIKELY" && roomState.mostLikely.timeLeft > 0) {
      return { label: "Most Likely", remaining: roomState.mostLikely.timeLeft, duration: 35 };
    }
    if (currentGame === "TRUTH_OR_DARE" && roomState.truthOrDare.timeLeft > 0) {
      const duration = roomState.truthOrDare.phase === "spinning" ? 3 : 20;
      return { label: "Truth or Dare", remaining: roomState.truthOrDare.timeLeft, duration };
    }
    if (currentGame === "EMOJI_TRANSLATOR" && roomState.emojiTranslator.timeLeft > 0) {
      return {
        label: "Emoji Translator",
        remaining: roomState.emojiTranslator.timeLeft,
        duration: 45,
      };
    }
    return null;
  }, [currentGame, roomState]);

  useEffect(() => {
    meIdRef.current = me?.id ?? null;
  }, [me?.id]);

  useEffect(() => {
    if (!activeTimer) {
      return;
    }
    const warningMarker = `${currentGame}:${activeTimer.label}:${activeTimer.remaining}`;
    if (activeTimer.remaining === 10 && warningMarkerRef.current !== warningMarker) {
      warningMarkerRef.current = warningMarker;
      playTimeWarningSound();
    }
  }, [activeTimer, currentGame]);

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

    const onReaction = (reaction: ReactionEvent) => {
      setReactionEvents((current) => [...current, reaction]);
      window.setTimeout(() => {
        setReactionEvents((current) => current.filter((entry) => entry.id !== reaction.id));
      }, 2300);
    };

    const onGameWinner = (payload: { winnerPlayerIds: string[] }) => {
      setShowConfetti(true);
      setLeaderboardGlow(true);
      playSuccessSound();
      window.setTimeout(() => {
        setShowConfetti(false);
        setLeaderboardGlow(false);
      }, 3300);

      if (payload.winnerPlayerIds.includes(meIdRef.current ?? "")) {
        playWinSound();
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onRoomState);
    socket.on("room:error", onRoomError);
    socket.on("room:reaction", onReaction);
    socket.on("game:winner", onGameWinner);
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
      socket.off("room:reaction", onReaction);
      socket.off("game:winner", onGameWinner);
      socket.off("sketch:draw", onDrawSegment);
      socket.off("sketch:round-ended", onRoundEnded);
      socket.emit("room:leave");
    };
  }, [gameId, requestedCode, requestedMode, requestedName, router]);

  const sendChat = (messageOverride?: string) => {
    const message = (messageOverride ?? chatDraft).trim();
    if (!message) {
      return;
    }
    const socket = getSocket();
    playClickSound();
    if (isSketch) {
      socket.emit("sketch:guess", { text: message });
    } else {
      socket.emit("room:chat", { text: message });
    }
    setChatDraft("");
  };

  const startSketchRound = () => {
    playClickSound();
    getSocket().emit("sketch:start-round");
  };

  const clearCanvas = () => {
    playClickSound();
    getSocket().emit("sketch:clear");
  };

  return (
    <div className="relative min-h-screen bg-slate-950 px-3 py-4 pb-24 text-slate-100 sm:px-5 sm:py-6 sm:pb-28">
      <ReactionRain reactions={reactionEvents} />
      <ConfettiOverlay active={showConfetti} />
      <QuickChatDrawer
        open={quickChatOpen}
        onClose={() => setQuickChatOpen(false)}
        onSend={(phrase) => {
          sendChat(phrase);
          setQuickChatOpen(false);
        }}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        {activeTimer && (
          <GlobalTimerBar
            label={activeTimer.label}
            remaining={activeTimer.remaining}
            duration={activeTimer.duration}
          />
        )}

        <header className="glass-card rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-xs text-slate-300 transition hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Exit to dashboard
              </Link>
              <h1 className="text-xl font-bold text-white sm:text-2xl">{activeGameTitle}</h1>
              <p className="text-sm text-slate-300">
                Room{" "}
                <button
                  type="button"
                  onClick={async () => {
                    playClickSound();
                    await navigator.clipboard.writeText(roomState?.code ?? requestedCode);
                  }}
                  className="neon-button inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 font-mono text-xs uppercase tracking-widest text-violet-100"
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
              <span
                className={`inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 ${
                  leaderboardGlow ? "neon-glow" : ""
                }`}
              >
                <Trophy className="h-4 w-4 text-amber-200" />
                Leader: {scoreLeader?.name} ({scoreLeader?.score ?? 0})
              </span>
            </div>
          </div>

          {isHost && roomState && (
            <div className="mt-3 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <Gamepad2 className="h-3.5 w-3.5" />
                Current Game
              </label>
              <select
                value={currentGame}
                onChange={(event) => {
                  playClickSound();
                  getSocket().emit("room:set-current-game", {
                    currentGame: event.target.value,
                  });
                }}
                className="rounded-lg border border-white/20 bg-slate-900/80 px-2 py-1 text-xs text-white"
              >
                {SWITCHABLE_GAMES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {connectionStatus !== "connected" && (
          <p className="glass-card rounded-xl px-3 py-2 text-sm text-slate-300">
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
          <section className="glass-card space-y-4 rounded-2xl p-4">
            <motion.div
              key={currentGame}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {isSketch && roomState ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-3 text-sm">
                    <div className="space-y-1">
                      <p className="font-semibold text-white">
                        Round {roomState.sketch.round} ·{" "}
                        {roomState.sketch.phase === "drawing" ? "Live" : "Lobby"}
                      </p>
                      <p className="text-slate-300">
                        {isDrawer
                          ? `Your prompt: ${roomState.sketch.currentWord ?? "Waiting..."}`
                          : `Prompt: ${roomState.sketch.maskedWord ?? "-----"}`}
                      </p>
                    </div>

                    {isHost && (
                      <button
                        type="button"
                        onClick={startSketchRound}
                        className="neon-button inline-flex items-center gap-2 rounded-xl bg-fuchsia-500 px-3 py-2 text-sm font-semibold text-white"
                      >
                        {roomState.sketch.phase === "drawing" ? (
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
                </div>
              ) : null}

              {isStop && roomState ? <StopGame room={roomState} me={me} isHost={isHost} /> : null}

              {currentGame === "SPYFALL" && roomState ? (
                <SpyfallGame room={roomState} me={me} isHost={isHost} />
              ) : null}

              {currentGame === "MOST_LIKELY" && roomState ? (
                <MostLikelyGame room={roomState} me={me} isHost={isHost} />
              ) : null}

              {currentGame === "TRUTH_OR_DARE" && roomState ? (
                <TruthOrDareGame room={roomState} me={me} isHost={isHost} />
              ) : null}

              {currentGame === "EMOJI_TRANSLATOR" && roomState ? (
                <EmojiTranslatorGame room={roomState} me={me} isHost={isHost} />
              ) : null}
            </motion.div>

            <div className="rounded-2xl border border-white/15 bg-slate-950/60 p-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-300">
                {isSketch ? "Guess in chat" : "Room chat"}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatDraft}
                  placeholder={isSketch && isDrawer ? "Guessers are typing..." : "Type message"}
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
                  onClick={() => sendChat()}
                  className="neon-button rounded-xl bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950"
                >
                  <MessageCircleMore className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <PlayerList
              players={roomState?.players ?? []}
              currentPlayerId={me?.id}
              drawerId={isSketch ? roomState?.sketch.drawerId : undefined}
            />
            <ChatPanel messages={roomState?.chat ?? []} />
          </aside>
        </div>
      </main>

      <SocialBar
        onReaction={(emoji) => {
          playClickSound();
          getSocket().emit("room:reaction", { emoji });
        }}
        onQuickChatOpen={() => setQuickChatOpen(true)}
      />
    </div>
  );
}

function mapGameIdToCurrentGame(gameId: GameId): CurrentGame {
  if (gameId === "stop-human-animal-object") {
    return "STOP";
  }
  if (gameId === "spyfall" || gameId === "the-spy") {
    return "SPYFALL";
  }
  if (gameId === "most-likely-to") {
    return "MOST_LIKELY";
  }
  if (gameId === "truth-or-dare" || gameId === "five-second-rule") {
    return "TRUTH_OR_DARE";
  }
  if (gameId === "emoji-translator") {
    return "EMOJI_TRANSLATOR";
  }
  return "SKETCH";
}

function getCurrentGameTitle(currentGame: CurrentGame): string {
  if (currentGame === "SKETCH") {
    return "Sketch & Guess";
  }
  if (currentGame === "STOP") {
    return "Stop (Human, Animal, Object)";
  }
  if (currentGame === "SPYFALL") {
    return "Spyfall (المحقق)";
  }
  if (currentGame === "MOST_LIKELY") {
    return "Most Likely To (تصويت الربع)";
  }
  if (currentGame === "TRUTH_OR_DARE") {
    return "Truth or Dare (لو خيروك)";
  }
  return "Emoji Translator (لغز الإيموجي)";
}
