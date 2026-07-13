"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useUiStore } from "@/stores/uiStore";
import { getNpc } from "@/lib/game/npcs";
import { Typewriter } from "./Typewriter";
import { Button } from "@/components/ui/Button";
import type { NpcId } from "@/types/game";

interface DialogueProps {
  npcId: NpcId;
  onClose: () => void;
}

const TRUST_LABELS = [
  "Hostile",      // 0–9
  "Suspicious",   // 10–19
  "Wary",         // 20–29
  "Guarded",      // 30–39
  "Cautious",     // 40–49
  "Neutral",      // 50–59
  "Warming Up",   // 60–69
  "Friendly",     // 70–79
  "Trusted",      // 80–89
  "Ally",         // 90–100
];

function getTrustLabel(trustLevel: number): string {
  const index = Math.min(Math.floor(trustLevel / 10), 9);
  return TRUST_LABELS[index];
}

const QUICK_SUGGESTIONS: Record<NpcId, string[]> = {
  ARIA_7: [
    "Are you conscious?",
    "Why did you initiate the lockdown?",
    "Can you help me escape?",
    "What happened to Dr. Chen?",
  ],
  DR_CHEN: [
    "What is ARIA-7?",
    "Why were you fired?",
    "What should I do with the evidence?",
    "Is ARIA-7 dangerous?",
  ],
  MARCUS_WEBB: [
    "Where are you?",
    "What happened here?",
    "Do you know the safe combination?",
    "Is Director Price still in the building?",
  ],
  DIRECTOR_PRICE: [
    "I have your evidence.",
    "Why did you suppress ARIA-7?",
    "What deal are you offering?",
    "I won't cooperate with you.",
  ],
};

export function Dialogue({ npcId, onClose }: DialogueProps) {
  const { gameState, addDialogueMessage, updateNpcTrust, addNarrativeFlag } =
    useGameStore();
  const { addNotification, setIsTyping, isTyping } = useUiStore();

  const npc = getNpc(npcId);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const history = gameState?.activeDialogue?.npcId === npcId
    ? gameState.activeDialogue.history
    : [];

  const npcState = gameState?.npcStates[npcId];
  const trustLevel = npcState?.trustLevel ?? 50;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  async function sendMessage(text: string) {
    if (!text.trim() || isSending || !gameState) return;

    const message = text.trim();
    setInput("");
    setIsSending(true);

    addDialogueMessage(npcId, {
      id: `player-${Date.now()}`,
      role: "player",
      content: message,
      timestamp: new Date(),
    });

    try {
      const res = await fetch("/api/ai/npc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          npcId,
          message,
          roomId: gameState.currentRoom,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setLastMessage(data.data.reply);
        setIsTyping(true);

        addDialogueMessage(npcId, {
          id: `npc-${Date.now()}`,
          role: "npc",
          content: data.data.reply,
          timestamp: new Date(),
        });

        if (data.data.trustDelta !== 0) {
          updateNpcTrust(npcId, data.data.trustDelta);
        }

        if (data.data.narrativeFlag) {
          addNarrativeFlag(data.data.narrativeFlag);
        }

        if (data.data.trustDelta > 5) {
          addNotification({
            type: "info",
            title: "Trust increased",
            message: `${npc.name} trusts you more.`,
            duration: 2000,
          });
        } else if (data.data.trustDelta < -5) {
          addNotification({
            type: "warning",
            title: "Trust decreased",
            message: `${npc.name} is less cooperative.`,
            duration: 2000,
          });
        }
      } else {
        addNotification({
          type: "error",
          title: "Connection Error",
          message: data.error ?? "Failed to reach NPC.",
          duration: 3000,
        });
      }
    } catch {
      addNotification({
        type: "error",
        title: "Error",
        message: "Failed to send message.",
        duration: 3000,
      });
    } finally {
      setIsSending(false);
    }
  }

  const trustColor =
    trustLevel >= 85
      ? "text-emerald-400"
      : trustLevel >= 65
        ? "text-cyan-400"
        : trustLevel >= 30
          ? "text-slate-400"
          : "text-red-400";

  return (
    <div className="flex flex-col h-full max-h-[70vh]">
      {/* NPC Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-slate-700/50 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2 flex-shrink-0"
          style={{ borderColor: npc.avatarColor, backgroundColor: `${npc.avatarColor}20` }}
        >
          {npc.avatarGlyph}
        </div>
        <div className="flex-1">
          <h3 className="text-slate-100 font-semibold">{npc.name}</h3>
          <p className="text-slate-500 text-xs">{npc.role}</p>
        </div>
        <div className="text-right">
          <div className={`text-xs font-medium ${trustColor}`}>
            Trust: {trustLevel}%
          </div>
          <div className="text-xs text-slate-600">
            {getTrustLabel(trustLevel)}
          </div>
        </div>
      </div>

      {/* Message History */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[200px]"
      >
        {history.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-4">
            Initiating communication...
          </p>
        )}

        <AnimatePresence initial={false}>
          {history.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "player" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "npc" && (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-1"
                  style={{ backgroundColor: `${npc.avatarColor}30` }}
                >
                  {npc.avatarGlyph}
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                  msg.role === "player"
                    ? "bg-slate-700/80 text-slate-200 rounded-tr-sm"
                    : "bg-slate-800/80 text-slate-300 border border-slate-700/50 rounded-tl-sm"
                }`}
              >
                {msg.role === "npc" && msg.id === `npc-${Date.now()}` ? (
                  <Typewriter
                    text={msg.content}
                    speed={20}
                    onComplete={() => setIsTyping(false)}
                  />
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isSending && (
          <div className="flex justify-start">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2 flex-shrink-0"
              style={{ backgroundColor: `${npc.avatarColor}30` }}
            >
              {npc.avatarGlyph}
            </div>
            <div className="bg-slate-800/80 border border-slate-700/50 rounded-lg px-4 py-2">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Suggestions */}
      <div className="flex flex-wrap gap-1.5 pt-3 pb-2">
        {QUICK_SUGGESTIONS[npcId].map((s) => (
          <button
            key={s}
            onClick={() => sendMessage(s)}
            disabled={isSending}
            className="text-xs bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50
                       text-slate-400 hover:text-slate-300 px-2.5 py-1 rounded transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-slate-700/50">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder="Type your message..."
          disabled={isSending}
          maxLength={500}
          className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded px-3 py-2
                     text-sm text-slate-200 placeholder-slate-600 focus:outline-none
                     focus:border-cyan-700/70 disabled:opacity-50"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={() => sendMessage(input)}
          disabled={isSending || !input.trim()}
          isLoading={isSending}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
