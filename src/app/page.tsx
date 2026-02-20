import Link from "next/link";
import { ArrowRight, Rocket, Wrench } from "lucide-react";
import { CategorySection } from "@/components/dashboard/category-section";
import { DASHBOARD_CATEGORIES } from "@/lib/game-catalog";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.18),_transparent_40%),radial-gradient(circle_at_bottom_left,_rgba(236,72,153,0.14),_transparent_35%)]" />
      <main className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 md:px-8">
        <header className="rounded-3xl border border-white/15 bg-slate-900/70 p-6 shadow-2xl shadow-indigo-950/50">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-100">
                <Rocket className="h-3.5 w-3.5" />
                The Ultimate Social & Family Games Platform
              </p>
              <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Spin up vibrant game rooms in seconds.
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Mobile-first party game rooms with synced timers, scores, and player turns. Start
                with Sketch & Guess now, then expand into Stop, The Spy, and 5-Second Rule.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <Link
                href="/lobby?game=sketch-and-guess&mode=create"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-violet-100"
              >
                Start Sketch & Guess
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/builder-tools"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Wrench className="h-4 w-4" />
                Open Builder Suite
              </Link>
            </div>
          </div>
        </header>

        <div className="space-y-10">
          {DASHBOARD_CATEGORIES.map((category) => (
            <CategorySection key={category.title} category={category} />
          ))}
        </div>
      </main>
    </div>
  );
}
