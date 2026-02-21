import type { GameId } from "@/types/realtime";

export interface GameCardConfig {
  id: GameId;
  title: string;
  subtitle: string;
  description: string;
  status: "live" | "coming-soon";
  accentClass: string;
}

export interface DashboardCategory {
  title: string;
  description: string;
  games: GameId[];
}

export const GAME_LIBRARY: Record<GameId, GameCardConfig> = {
  "sketch-and-guess": {
    id: "sketch-and-guess",
    title: "Sketch & Guess",
    subtitle: "Draw fast, guess faster",
    description: "Take turns drawing secret prompts while everyone races to guess in live chat.",
    status: "live",
    accentClass: "from-fuchsia-500 to-rose-500",
  },
  "stop-human-animal-object": {
    id: "stop-human-animal-object",
    title: "Stop: Human, Animal, Object",
    subtitle: "Beat the buzzer",
    description: "A timed category showdown with room-wide validation and score sync.",
    status: "live",
    accentClass: "from-amber-500 to-orange-500",
  },
  spyfall: {
    id: "spyfall",
    title: "Spyfall (المحقق)",
    subtitle: "Reveal, discuss, accuse",
    description:
      "One secret spy hides among citizens. Reveal your card, debate under pressure, then vote.",
    status: "live",
    accentClass: "from-violet-500 to-indigo-500",
  },
  "most-likely-to": {
    id: "most-likely-to",
    title: "Most Likely To (تصويت الربع)",
    subtitle: "Vote your friends instantly",
    description:
      "A random social prompt appears and everyone votes for who matches it best.",
    status: "live",
    accentClass: "from-cyan-500 to-sky-500",
  },
  "truth-or-dare": {
    id: "truth-or-dare",
    title: "Truth or Dare (لو خيروك)",
    subtitle: "Spin and commit",
    description:
      "Spin a dramatic wheel to pick a player and a random Truth or Dare challenge.",
    status: "live",
    accentClass: "from-pink-500 to-orange-500",
  },
  "emoji-translator": {
    id: "emoji-translator",
    title: "Emoji Translator (لغز الإيموجي)",
    subtitle: "Decode fast",
    description:
      "Guess movies and phrases from emoji sequences before anyone else types the answer.",
    status: "live",
    accentClass: "from-emerald-500 to-cyan-500",
  },
  "the-spy": {
    id: "the-spy",
    title: "Spyfall (Legacy)",
    subtitle: "Use Spyfall card instead",
    description: "Legacy alias for Spyfall rooms.",
    status: "live",
    accentClass: "from-violet-500 to-indigo-500",
  },
  "five-second-rule": {
    id: "five-second-rule",
    title: "5-Second Rule (Legacy)",
    subtitle: "Legacy alias",
    description: "Legacy card retained for compatibility with previous rooms.",
    status: "live",
    accentClass: "from-emerald-500 to-cyan-500",
  },
};

export const DASHBOARD_CATEGORIES: DashboardCategory[] = [
  {
    title: "Classic Cards",
    description: "Quick-to-learn party classics you can host instantly.",
    games: ["truth-or-dare", "most-likely-to"],
  },
  {
    title: "Speed & Trivia",
    description: "Fast rounds, buzzer pressure, and noisy celebrations.",
    games: ["sketch-and-guess", "stop-human-animal-object", "emoji-translator"],
  },
  {
    title: "Mystery & Roleplay",
    description: "Social deduction and bluff-heavy group favorites.",
    games: ["spyfall"],
  },
  {
    title: "Game Builder Tools",
    description: "Build your own jigsaw, quiz, wheel, and custom bingo sets.",
    games: [],
  },
];

export const BUILDER_TOOL_NAMES = [
  "Jigsaw Puzzle Builder",
  "Custom Quiz Builder",
  "Spin-the-Wheel Builder",
  "Personal Bingo Builder",
];
