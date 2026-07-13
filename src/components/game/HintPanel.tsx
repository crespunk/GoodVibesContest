"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useUiStore } from "@/stores/uiStore";
import { getPuzzle } from "@/lib/game/puzzles";
import { Button } from "@/components/ui/Button";
import { Typewriter } from "./Typewriter";
import type { PuzzleId } from "@/types/game";

interface HintPanelProps {
  puzzleId: PuzzleId;
}

const LEVEL_LABELS = ["", "Vague", "Suggestive", "Guided", "Specific", "Solution"];
const LEVEL_COLORS = [
  "",
  "text-slate-400",
  "text-yellow-400",
  "text-orange-400",
  "text-red-400",
  "text-red-300",
];

export function HintPanel({ puzzleId }: HintPanelProps) {
  const { gameState } = useGameStore();
  const { addNotification } = useUiStore();

  const [hints, setHints] = useState<Array<{ level: number; text: string; fresh?: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const puzzle = getPuzzle(puzzleId);
  const puzzleState = gameState?.puzzleStates[puzzleId];

  // Restore previously-requested hints for this puzzle so the count and cards
  // persist across closing and reopening the hint panel.
  useEffect(() => {
    if (!gameState) return;
    let cancelled = false;
    setIsLoadingHistory(true);

    const params = new URLSearchParams({ sessionId: gameState.sessionId, puzzleId });
    fetch(`/api/ai/hint?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        setHints(data.data.hints.map((h: { level: number; text: string }) => ({ ...h, fresh: false })));
        setHasMore(data.data.hasMore);
      })
      .catch(() => { /* keep panel usable even if history fails to load */ })
      .finally(() => { if (!cancelled) setIsLoadingHistory(false); });

    return () => { cancelled = true; };
  }, [gameState?.sessionId, puzzleId]);

  async function requestHint() {
    if (!gameState || isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          puzzleId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setHints((prev) => [...prev, { level: data.data.level, text: data.data.hint, fresh: true }]);
        setHasMore(data.data.hasMore);
      } else {
        addNotification({
          type: "error",
          title: "Hint Error",
          message: data.error ?? "Could not generate hint.",
          duration: 3000,
        });
      }
    } catch {
      addNotification({
        type: "error",
        title: "Error",
        message: "Failed to get hint.",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-slate-200 font-semibold text-sm">{puzzle.title}</h4>
        <p className="text-slate-500 text-xs mt-1">{puzzle.description}</p>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>Difficulty: {"★".repeat(puzzle.difficulty)}{"☆".repeat(5 - puzzle.difficulty)}</span>
        <span>Attempts: {puzzleState?.attempts ?? 0}</span>
        <span>Hints used: {hints.length}/5</span>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        <AnimatePresence>
          {hints.map((hint, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-4"
            >
              <div className={`text-xs font-semibold mb-2 ${LEVEL_COLORS[hint.level]}`}>
                Hint {i + 1} — {LEVEL_LABELS[hint.level]}
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                {hint.fresh && i === hints.length - 1 ? (
                  <Typewriter text={hint.text} speed={20} />
                ) : (
                  hint.text
                )}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!hasMore && hints.length > 0 && (
        <p className="text-slate-600 text-xs text-center">
          No further hints available. The solution has been revealed.
        </p>
      )}

      <Button
        variant={hints.length === 0 ? "primary" : "secondary"}
        size="md"
        className="w-full"
        onClick={requestHint}
        isLoading={isLoading}
        disabled={!hasMore || isLoading || isLoadingHistory}
      >
        {isLoadingHistory
          ? "Loading…"
          : hints.length === 0
            ? "Request a Hint"
            : hints.length >= 5
              ? "No More Hints"
              : "Get Another Hint"}
      </Button>

      <p className="text-xs text-slate-600 text-center">
        Hints progress from subtle to explicit. Use sparingly for the best experience.
      </p>
    </div>
  );
}
