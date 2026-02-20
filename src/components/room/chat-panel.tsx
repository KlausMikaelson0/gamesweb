"use client";

import { useEffect, useMemo, useRef } from "react";
import { MessageCircle } from "lucide-react";
import type { ChatMessage } from "@/types/realtime";

interface ChatPanelProps {
  messages: ChatMessage[];
}

export function ChatPanel({ messages }: ChatPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const recentMessages = useMemo(() => messages.slice(-40), [messages]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [recentMessages]);

  return (
    <section className="flex min-h-80 flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-900/60">
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm font-semibold text-slate-100">
        <MessageCircle className="h-4 w-4" />
        Live Chat
      </header>
      <div ref={containerRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {recentMessages.length === 0 ? (
          <p className="text-sm text-slate-400">Chat appears here when the room starts talking.</p>
        ) : (
          recentMessages.map((message) => (
            <div
              key={message.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                message.type === "system"
                  ? "bg-white/5 text-slate-300"
                  : message.type === "correct"
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "bg-violet-500/20 text-violet-100"
              }`}
            >
              <span className="mr-1 font-semibold">{message.from}:</span>
              <span>{message.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
