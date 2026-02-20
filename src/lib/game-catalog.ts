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
  "the-spy": {
    id: "the-spy",
    title: "The Spy",
    subtitle: "Trust no one",
    description: "Secret role assignment with citizens vs spy logic and accusation rounds.",
    status: "coming-soon",
    accentClass: "from-violet-500 to-indigo-500",
  },
  "five-second-rule": {
    id: "five-second-rule",
    title: "5-Second Rule",
    subtitle: "Say 3 things... now!",
    description: "Funny prompts plus a dramatic visual timer and room-wide scoring.",
    status: "coming-soon",
    accentClass: "from-emerald-500 to-cyan-500",
  },
};

export const DASHBOARD_CATEGORIES: DashboardCategory[] = [
  {
    title: "Classic Cards",
    description: "Quick-to-learn party classics you can host instantly.",
    games: ["five-second-rule"],
  },
  {
    title: "Speed & Trivia",
    description: "Fast rounds, buzzer pressure, and noisy celebrations.",
    games: ["sketch-and-guess", "stop-human-animal-object"],
  },
  {
    title: "Mystery & Roleplay",
    description: "Social deduction and bluff-heavy group favorites.",
    games: ["the-spy"],
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
