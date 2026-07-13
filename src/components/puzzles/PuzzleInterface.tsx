"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useUiStore } from "@/stores/uiStore";
import { getPuzzle } from "@/lib/game/puzzles";
import { getItem } from "@/lib/game/items";
import { HintPanel } from "@/components/game/HintPanel";
import { Button } from "@/components/ui/Button";
import type { PuzzleId, ItemId } from "@/types/game";

interface PuzzleInterfaceProps {
  puzzleId: PuzzleId;
  onClose: () => void;
  onSolve: (items: ItemId[]) => void;
}

export function PuzzleInterface({
  puzzleId,
  onClose,
  onSolve,
}: PuzzleInterfaceProps) {
  const { gameState, markPuzzleSolved, addToInventory } = useGameStore();
  const { addNotification } = useUiStore();

  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [showHints, setShowHints] = useState(false);

  const puzzle = getPuzzle(puzzleId);
  const puzzleState = gameState?.puzzleStates[puzzleId];
  const isSolved = puzzleState?.status === "SOLVED";

  async function handleSubmit() {
    if (!answer.trim() || isSubmitting || !gameState) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/game/puzzle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          puzzleId,
          answer: answer.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        const { correct, message, reward } = data.data;

        if (correct) {
          setFeedback({ type: "success", message });
          markPuzzleSolved(puzzleId);

          const rewardItems: ItemId[] = reward?.items ?? [];
          for (const itemId of rewardItems) {
            addToInventory(itemId);
          }

          addNotification({
            type: "success",
            title: "Puzzle Solved!",
            message: puzzle.title,
            duration: 4000,
          });

          if (rewardItems.length > 0) {
            addNotification({
              type: "item",
              title: "Item Received",
              message: rewardItems.map((id) => getItem(id).name).join(", "),
              duration: 5000,
            });
          }

          setTimeout(() => {
            onSolve(rewardItems);
          }, 1500);
        } else {
          setFeedback({ type: "error", message });
        }
      }
    } catch {
      setFeedback({ type: "error", message: "Connection error. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSolved) {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-4">✅</div>
        <h3 className="text-emerald-400 font-semibold text-lg mb-2">
          Already Solved
        </h3>
        <p className="text-slate-400 text-sm">
          You have already solved {puzzle.title}.
        </p>
        <Button variant="secondary" className="mt-6" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Puzzle Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium bg-slate-700/80 text-slate-400 px-2 py-0.5 rounded border border-slate-600/50 uppercase tracking-wider">
            {puzzle.type.replace("_", " ")}
          </span>
          <span className="text-xs text-slate-600">
            {"★".repeat(puzzle.difficulty)}{"☆".repeat(5 - puzzle.difficulty)}
          </span>
        </div>
        <h3 className="text-slate-100 font-semibold text-lg">{puzzle.title}</h3>
        <p className="text-slate-400 text-sm mt-2 leading-relaxed">
          {puzzle.description}
        </p>
      </div>

      {/* Puzzle Input based on type */}
      <PuzzleInput
        puzzle={puzzle}
        answer={answer}
        setAnswer={setAnswer}
        onSubmit={handleSubmit}
        disabled={isSubmitting}
      />

      {/* Feedback */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded border text-sm ${
            feedback.type === "success"
              ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300"
              : "bg-red-900/30 border-red-700/50 text-red-300"
          }`}
        >
          {feedback.message}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHints(!showHints)}
        >
          {showHints ? "Hide Hints" : "Need a Hint?"}
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!answer.trim()}
          >
            Submit
          </Button>
        </div>
      </div>

      {/* Hint System */}
      {showHints && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="border-t border-slate-700/50 pt-4"
        >
          <HintPanel puzzleId={puzzleId} />
        </motion.div>
      )}
    </div>
  );
}

interface PuzzleInputProps {
  puzzle: ReturnType<typeof getPuzzle>;
  answer: string;
  setAnswer: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}

function PuzzleInput({
  puzzle,
  answer,
  setAnswer,
  onSubmit,
  disabled,
}: PuzzleInputProps) {
  const baseInputClass = `
    w-full bg-slate-800/60 border border-slate-700/50 rounded px-4 py-3
    text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-700/70
    font-mono text-sm disabled:opacity-50
  `;

  if (puzzle.type === "TERMINAL") {
    return (
      <div className="bg-black/80 border border-green-900/50 rounded-lg p-4 font-mono">
        <div className="text-green-500 text-xs mb-3">
          NEXUS-OS v4.2.1 — Root Terminal
          <br />
          <span className="text-green-700">Awaiting command...</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-sm">{">"}</span>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="enter command..."
            disabled={disabled}
            className="flex-1 bg-transparent text-green-400 focus:outline-none text-sm font-mono"
            autoFocus
          />
        </div>
      </div>
    );
  }

  if (puzzle.type === "MECHANICAL") {
    const parts = answer.split("-");
    return (
      <div className="space-y-3">
        <p className="text-slate-500 text-xs">
          Enter combination as: XX-YY-ZZ (e.g. 05-19-97)
        </p>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="00-00-00"
          disabled={disabled}
          className={baseInputClass}
          maxLength={12}
          autoFocus
        />
        <div className="flex gap-2 justify-center">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-1 h-1.5 rounded bg-slate-700"
              style={{
                backgroundColor:
                  parts[i] && parts[i].length > 0 ? "#06b6d4" : undefined,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (puzzle.type === "CIPHER") {
    return (
      <div className="space-y-3">
        <div className="bg-slate-800/60 border border-slate-700/40 rounded p-3">
          <p className="text-slate-500 text-xs mb-1 uppercase tracking-wider">
            Encoded:
          </p>
          <p className="text-amber-400 font-mono text-sm">
            {puzzle.description.match(/['"](.*?)['"]/)?.[1] ??
              "See puzzle description above"}
          </p>
        </div>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="DECODED TEXT"
          disabled={disabled}
          className={`${baseInputClass} uppercase tracking-widest`}
          autoFocus
        />
      </div>
    );
  }

  return (
    <input
      type="text"
      value={answer}
      onChange={(e) => setAnswer(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && onSubmit()}
      placeholder="Enter your answer..."
      disabled={disabled}
      className={baseInputClass}
      autoFocus
    />
  );
}
