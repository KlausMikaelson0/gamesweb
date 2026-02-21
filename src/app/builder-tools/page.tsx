"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ImagePlus, ListPlus, RotateCw, TableCellsSplit } from "lucide-react";

export default function BuilderToolsPage() {
  const [jigsawImageUrl, setJigsawImageUrl] = useState<string | null>(null);
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<string[]>([]);
  const [wheelItem, setWheelItem] = useState("");
  const [wheelItems, setWheelItems] = useState<string[]>(["Dance challenge", "Tell a joke"]);
  const [bingoInput, setBingoInput] = useState("");
  const [bingoPhrases, setBingoPhrases] = useState<string[]>([
    "Says 'it depends'",
    "Shares a meme",
    "Asks for a hint",
    "Celebrates early",
    "Blames lag",
    "Changes nickname",
  ]);

  const bingoCard = useMemo(() => buildBingoCard(bingoPhrases), [bingoPhrases]);

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <header className="rounded-3xl border border-white/15 bg-slate-900/70 p-6">
          <h1 className="text-3xl font-bold text-white">Game Builder Suite</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Build custom game packs and re-use them in rooms. This first version stores everything
            locally in the browser, ready to be connected to persistence later.
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-2">
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/15 bg-slate-900/60 p-5"
          >
            <header className="mb-4 flex items-center gap-2">
              <ImagePlus className="h-5 w-5 text-fuchsia-200" />
              <h2 className="text-lg font-semibold text-white">Jigsaw Puzzle Builder</h2>
            </header>
            <label className="block rounded-2xl border border-dashed border-white/25 p-4 text-sm">
              <span className="block text-slate-300">Upload an image</span>
              <input
                type="file"
                accept="image/*"
                className="mt-2 block w-full text-xs"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    return;
                  }
                  setJigsawImageUrl(URL.createObjectURL(file));
                }}
              />
            </label>

            {jigsawImageUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/20">
                <Image
                  src={jigsawImageUrl}
                  alt="Jigsaw preview"
                  width={900}
                  height={420}
                  unoptimized
                  className="h-56 w-full object-cover"
                />
              </div>
            )}
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/15 bg-slate-900/60 p-5"
          >
            <header className="mb-4 flex items-center gap-2">
              <ListPlus className="h-5 w-5 text-cyan-200" />
              <h2 className="text-lg font-semibold text-white">Custom Quiz Builder</h2>
            </header>
            <div className="flex gap-2">
              <input
                type="text"
                value={quizQuestion}
                placeholder="Add a quiz prompt..."
                onChange={(event) => setQuizQuestion(event.target.value)}
                className="flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const value = quizQuestion.trim();
                  if (!value) {
                    return;
                  }
                  setQuizQuestions((current) => [...current, value]);
                  setQuizQuestion("");
                }}
                className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                Add
              </button>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-200">
              {quizQuestions.length === 0 ? (
                <li className="text-slate-400">No questions yet.</li>
              ) : (
                quizQuestions.map((question, index) => (
                  <li key={`${question}-${index}`} className="rounded-xl bg-white/5 px-3 py-2">
                    {index + 1}. {question}
                  </li>
                ))
              )}
            </ul>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/15 bg-slate-900/60 p-5"
          >
            <header className="mb-4 flex items-center gap-2">
              <RotateCw className="h-5 w-5 text-amber-200" />
              <h2 className="text-lg font-semibold text-white">Spin-the-Wheel Generator</h2>
            </header>
            <div className="flex gap-2">
              <input
                type="text"
                value={wheelItem}
                placeholder="Add wheel item..."
                onChange={(event) => setWheelItem(event.target.value)}
                className="flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const value = wheelItem.trim();
                  if (!value) {
                    return;
                  }
                  setWheelItems((items) => [...items, value]);
                  setWheelItem("");
                }}
                className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                Add
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {wheelItems.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="rounded-full bg-amber-300/20 px-3 py-1 text-xs font-semibold text-amber-100"
                >
                  {item}
                </span>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-white/15 bg-slate-900/60 p-5"
          >
            <header className="mb-4 flex items-center gap-2">
              <TableCellsSplit className="h-5 w-5 text-emerald-200" />
              <h2 className="text-lg font-semibold text-white">Custom Bingo Cards</h2>
            </header>
            <div className="flex gap-2">
              <input
                type="text"
                value={bingoInput}
                placeholder="Add a phrase..."
                onChange={(event) => setBingoInput(event.target.value)}
                className="flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const value = bingoInput.trim();
                  if (!value) {
                    return;
                  }
                  setBingoPhrases((items) => [...items, value]);
                  setBingoInput("");
                }}
                className="rounded-xl bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950"
              >
                Add
              </button>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-1 rounded-2xl bg-slate-950 p-2 text-[10px] sm:text-xs">
              {bingoCard.map((entry, index) => (
                <div
                  key={`${entry}-${index}`}
                  className="flex min-h-14 items-center justify-center rounded-lg bg-white/10 px-1 text-center"
                >
                  {entry}
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}

function buildBingoCard(phrases: string[]): string[] {
  const entries = [...phrases].filter(Boolean);
  const shuffled = entries.sort(() => Math.random() - 0.5);
  const result: string[] = [];

  for (let index = 0; index < 25; index += 1) {
    if (index === 12) {
      result.push("FREE");
      continue;
    }

    const value = shuffled[index % Math.max(1, shuffled.length)] ?? "Add more phrases";
    result.push(value);
  }

  return result;
}
