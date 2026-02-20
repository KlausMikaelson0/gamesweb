import { Sparkles } from "lucide-react";
import { GameCard } from "@/components/dashboard/game-card";
import {
  BUILDER_TOOL_NAMES,
  GAME_LIBRARY,
  type DashboardCategory,
} from "@/lib/game-catalog";

interface CategorySectionProps {
  category: DashboardCategory;
}

export function CategorySection({ category }: CategorySectionProps) {
  const gameCards = category.games.map((gameId) => GAME_LIBRARY[gameId]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">{category.title}</h2>
          <p className="text-sm text-slate-300">{category.description}</p>
        </div>
      </header>

      {category.games.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gameCards.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-white/25 bg-slate-900/50 p-6">
          <div className="mb-3 flex items-center gap-2 text-violet-100">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">Builder Modules</span>
          </div>
          <ul className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
            {BUILDER_TOOL_NAMES.map((toolName) => (
              <li key={toolName} className="rounded-xl bg-white/5 px-3 py-2">
                {toolName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
