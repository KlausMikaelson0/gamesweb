import { Crown, UserRound } from "lucide-react";
import type { PlayerState } from "@/types/realtime";

interface PlayerListProps {
  players: PlayerState[];
  currentPlayerId?: string;
  drawerId?: string | null;
}

export function PlayerList({ players, currentPlayerId, drawerId }: PlayerListProps) {
  return (
    <section className="glass-card rounded-2xl p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">
        Players
      </h2>
      <ul className="space-y-2">
        {players.map((player) => {
          const isMe = player.id === currentPlayerId;
          const isDrawer = drawerId === player.id;

          return (
            <li
              key={player.id}
              className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                isMe ? "bg-violet-500/25" : "bg-white/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-slate-200" />
                <span className="text-sm text-white">
                  {player.name}
                  {isMe ? " (You)" : ""}
                </span>
                {player.isHost && <Crown className="h-4 w-4 text-amber-300" />}
                {isDrawer && (
                  <span className="rounded-md bg-fuchsia-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-fuchsia-100">
                    Drawing
                  </span>
                )}
              </div>
              <span className="text-sm font-semibold text-cyan-200">{player.score}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
