"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Flag,
  PlayCircle,
  ShieldCheck,
  ShieldX,
  Timer,
  Vote,
} from "lucide-react";
import { getSocket } from "@/lib/socket-client";
import type {
  PlayerState,
  RoomState,
  StopField,
} from "@/types/realtime";

interface StopGameProps {
  room: RoomState;
  me: PlayerState | null;
  isHost: boolean;
}

const STOP_FIELDS: Array<{
  key: StopField;
  label: string;
  placeholder: string;
}> = [
  { key: "name", label: "Name", placeholder: "Nina" },
  { key: "animal", label: "Animal", placeholder: "Narwhal" },
  { key: "object", label: "Object", placeholder: "Notebook" },
  { key: "country", label: "Country", placeholder: "Norway" },
  { key: "food", label: "Food", placeholder: "Noodles" },
];

export function StopGame({ room, me, isHost }: StopGameProps) {
  const stopState = room.stop;
  const mySubmission = useMemo(
    () => stopState.submissions.find((submission) => submission.playerId === me?.id),
    [me?.id, stopState.submissions],
  );
  const stopByPlayer = room.players.find((player) => player.id === stopState.stopByPlayerId);

  const canEdit = Boolean(
    mySubmission &&
      (stopState.phase === "input" || stopState.phase === "countdown") &&
      !mySubmission.locked,
  );
  const canTriggerStop =
    stopState.phase === "input" &&
    canEdit &&
    STOP_FIELDS.every(({ key }) => (mySubmission?.answers[key] ?? "").trim().length > 0);
  const canVote = stopState.phase === "voting";

  const phaseDescription = getPhaseDescription(stopState.phase);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/15 bg-slate-950/45 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-3xl font-black text-slate-950">
              {stopState.letter || "?"}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
                STOP Round {stopState.round}
              </p>
              <p className="text-lg font-semibold text-white">{phaseDescription}</p>
              {stopState.phase === "countdown" && (
                <p className="text-sm text-amber-100">
                  {stopByPlayer?.name ?? "A player"} pressed STOP. {stopState.timeLeft}s left.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(stopState.phase === "countdown" || stopState.phase === "voting") && (
              <span className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-sm">
                <Timer className="h-4 w-4" />
                {stopState.timeLeft}s
              </span>
            )}

            {isHost && (
              <button
                type="button"
                onClick={() => getSocket().emit("stop:start-round")}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                <PlayCircle className="h-4 w-4" />
                {stopState.phase === "lobby" || stopState.phase === "results"
                  ? "Generate Letter"
                  : "Restart Letter"}
              </button>
            )}

            {canTriggerStop && (
              <button
                type="button"
                onClick={() => getSocket().emit("stop:trigger-stop")}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
              >
                <Flag className="h-4 w-4" />
                STOP
              </button>
            )}

            {isHost && canVote && (
              <button
                type="button"
                onClick={() => getSocket().emit("stop:finalize-voting")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Vote className="h-4 w-4" />
                Finalize Voting
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/15 bg-slate-950/45 p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">
          Quick Entry Form
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {STOP_FIELDS.map((field) => {
            const answer = mySubmission?.answers[field.key] ?? "";
            const fieldAutoValid = mySubmission?.autoValid[field.key] ?? false;
            const showAutoValid = stopState.phase === "voting" || stopState.phase === "results";

            return (
              <label
                key={field.key}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-xs"
              >
                <span className="mb-1 block font-semibold uppercase tracking-wide text-slate-300">
                  {field.label}
                </span>
                <input
                  key={`${field.key}-${stopState.round}-${stopState.phase}-${mySubmission?.playerId ?? "none"}`}
                  type="text"
                  defaultValue={answer}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    getSocket().emit("stop:update-answers", {
                      answers: { [field.key]: nextValue },
                    });
                  }}
                  placeholder={field.placeholder}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-white/15 bg-slate-900 px-2 py-2 text-sm text-white outline-none transition focus:border-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                />
                {showAutoValid && (
                  <span
                    className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                      fieldAutoValid
                        ? "bg-emerald-500/20 text-emerald-100"
                        : "bg-rose-500/20 text-rose-100"
                    }`}
                  >
                    {fieldAutoValid ? <ShieldCheck className="h-3 w-3" /> : <ShieldX className="h-3 w-3" />}
                    Auto check
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </section>

      {(stopState.phase === "voting" || stopState.phase === "results") && (
        <section className="space-y-3 rounded-2xl border border-white/15 bg-slate-950/45 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
            {stopState.phase === "voting" ? "Voting Phase" : "Round Results"}
          </h3>
          <p className="text-sm text-slate-300">
            {stopState.phase === "voting"
              ? "Vote on each answer (Real/Fake). Auto-check verifies starting letter first."
              : "Scoring rule: 10 points for a unique correct answer, 5 points for duplicate correct answers."}
          </p>

          <div className="space-y-3">
            {stopState.submissions.map((submission) => {
              const isMe = submission.playerId === me?.id;

              return (
                <motion.article
                  key={submission.playerId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border p-3 ${
                    isMe ? "border-amber-300/40 bg-amber-400/10" : "border-white/10 bg-white/5"
                  }`}
                >
                  <header className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">
                      {submission.playerName}
                      {isMe ? " (You)" : ""}
                    </p>
                    {stopState.phase === "results" && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-100">
                        <CheckCircle2 className="h-3.5 w-3.5" />+{submission.totalRoundPoints}
                      </span>
                    )}
                  </header>

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                    {STOP_FIELDS.map((field) => {
                      const vote = submission.votes[field.key];
                      const canVoteField =
                        canVote &&
                        !isMe &&
                        submission.answers[field.key].trim().length > 0 &&
                        submission.autoValid[field.key];
                      const communityValid = submission.communityValid[field.key];
                      const points = submission.pointsByField[field.key];

                      return (
                        <div key={field.key} className="rounded-xl border border-white/10 bg-slate-900/50 p-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                            {field.label}
                          </p>
                          <p className="mt-1 min-h-6 text-sm font-semibold text-white">
                            {submission.answers[field.key] || "-"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                submission.autoValid[field.key]
                                  ? "bg-emerald-500/20 text-emerald-100"
                                  : "bg-rose-500/20 text-rose-100"
                              }`}
                            >
                              Auto {submission.autoValid[field.key] ? "ok" : "fail"}
                            </span>

                            {stopState.phase === "results" && (
                              <>
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                    communityValid
                                      ? "bg-cyan-400/20 text-cyan-100"
                                      : "bg-slate-600/50 text-slate-200"
                                  }`}
                                >
                                  Vote {communityValid ? "accepted" : "rejected"}
                                </span>
                                <span className="rounded-md bg-amber-300/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
                                  +{points}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-300">
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5">Yes {vote.yes}</span>
                            <span className="rounded-md bg-white/10 px-1.5 py-0.5">No {vote.no}</span>
                          </div>

                          {canVoteField && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  getSocket().emit("stop:vote", {
                                    targetPlayerId: submission.playerId,
                                    field: field.key,
                                    isValid: true,
                                  })
                                }
                                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                  vote.myVote === true
                                    ? "bg-emerald-400 text-slate-950"
                                    : "bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                                }`}
                              >
                                Real
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  getSocket().emit("stop:vote", {
                                    targetPlayerId: submission.playerId,
                                    field: field.key,
                                    isValid: false,
                                  })
                                }
                                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                  vote.myVote === false
                                    ? "bg-rose-400 text-white"
                                    : "bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                                }`}
                              >
                                Fake
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function getPhaseDescription(
  phase: RoomState["stop"]["phase"],
): string {
  if (phase === "lobby") {
    return "Waiting for host to generate a letter";
  }
  if (phase === "input") {
    return "Fill all categories and press STOP first";
  }
  if (phase === "countdown") {
    return "STOP triggered - final 5 second rush";
  }
  if (phase === "voting") {
    return "Vote answers as real or fake";
  }
  return "Results are ready";
}
