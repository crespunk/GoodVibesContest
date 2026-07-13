"use client";

import { useEffect, useState } from "react";
import { useUiStore } from "@/stores/uiStore";
import type { NotificationRecord } from "@/stores/uiStore";
import { useGameStore } from "@/stores/gameStore";
import { Modal } from "@/components/ui/Modal";
import { Dialogue } from "./Dialogue";
import { PuzzleInterface } from "@/components/puzzles/PuzzleInterface";
import { Inventory } from "./Inventory";
import { Typewriter } from "./Typewriter";
import { HintPanel } from "./HintPanel";
import { EndingScreen } from "./EndingScreen";
import { useGraphicsStore, type GraphicsQuality } from "@/stores/graphicsStore";
import type { NpcId, PuzzleId, ItemId, RoomId } from "@/types/game";
import { getNpc } from "@/lib/game/npcs";
import { getPuzzle, PUZZLES } from "@/lib/game/puzzles";

export function ModalController() {
  const {
    activeModal,
    activePanel,
    activePuzzleId,
    activeNpcId,
    activeInspectionText,
    closeModal,
    togglePanel,
    openEndingModal,
  } = useUiStore();
  const { addNarrativeFlag, addToInventory } = useGameStore();

  function handlePuzzleSolve(items: ItemId[]) {
    // Solving the escape pod's launch sequence is the win condition — instead
    // of just closing the modal and dropping the player back in the room,
    // transition straight to the ending screen.
    if (activePuzzleId === "FINAL_ESCAPE_POD") {
      openEndingModal();
      return;
    }
    closeModal();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "KeyI" || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      togglePanel("inventory");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePanel]);

  return (
    <>
      {/* Ending Screen — full-screen takeover, not a boxed Modal */}
      {activeModal === "ending" && <EndingScreen />}

      {/* Dialogue Modal */}
      {activeModal === "dialogue" && activeNpcId && (
        <Modal
          isOpen
          onClose={closeModal}
          size="lg"
          title={getNpc(activeNpcId as NpcId).name}
        >
          <Dialogue
            npcId={activeNpcId as NpcId}
            onClose={closeModal}
          />
        </Modal>
      )}

      {/* Puzzle Modal */}
      {activeModal === "puzzle" && activePuzzleId && (
        <Modal
          isOpen
          onClose={closeModal}
          size="xl"
          title={getPuzzle(activePuzzleId as PuzzleId).title}
        >
          <PuzzleInterface
            puzzleId={activePuzzleId as PuzzleId}
            onClose={closeModal}
            onSolve={handlePuzzleSolve}
          />
        </Modal>
      )}

      {/* Object Inspection Modal */}
      {activeModal === "inspection" && activeInspectionText && (
        <Modal isOpen onClose={closeModal} size="md" title="Examine">
          <div className="text-slate-300 text-sm leading-relaxed">
            <Typewriter text={activeInspectionText} speed={18} />
          </div>
          <button
            onClick={closeModal}
            className="mt-6 text-slate-500 hover:text-slate-300 text-xs underline"
          >
            Close
          </button>
        </Modal>
      )}

      {/* Inventory Panel */}
      {activePanel === "inventory" && (
        <Modal
          isOpen
          onClose={() => togglePanel("inventory")}
          size="md"
          title="Inventory"
        >
          <Inventory />
        </Modal>
      )}

      {/* Notifications Panel */}
      {activePanel === "notifications" && (
        <Modal
          isOpen
          onClose={() => togglePanel("notifications")}
          size="full"
          title="System Alerts"
        >
          <NotificationsPanel />
        </Modal>
      )}

      {/* Hint Panel */}
      {activePanel === "hint" && (
        <Modal
          isOpen
          onClose={() => togglePanel("hint")}
          size="md"
          title="Hints"
        >
          <RoomHintPanel />
        </Modal>
      )}

      {/* Save Panel */}
      {activePanel === "save" && (
        <Modal
          isOpen
          onClose={() => togglePanel("save")}
          size="sm"
          title="Save Game"
        >
          <SavePanel />
        </Modal>
      )}

      {/* Graphics Settings Panel */}
      {activePanel === "settings" && (
        <Modal
          isOpen
          onClose={() => togglePanel("settings")}
          size="sm"
          title="Graphics Quality"
        >
          <GraphicsSettingsPanel />
        </Modal>
      )}
    </>
  );
}

const NOTIF_TYPE_STYLES: Record<NotificationRecord["type"], string> = {
  info:    "border-slate-600/50 text-slate-300",
  success: "border-emerald-700/50 text-emerald-300",
  warning: "border-amber-700/50 text-amber-300",
  error:   "border-red-700/50 text-red-300",
  item:    "border-cyan-700/50 text-cyan-300",
};

const NOTIF_TYPE_ICONS: Record<NotificationRecord["type"], string> = {
  info: "ℹ", success: "✓", warning: "⚠", error: "✕", item: "✦",
};

function NotificationsPanel() {
  const { notificationHistory, removeNotificationFromHistory } = useUiStore();

  if (notificationHistory.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-8">
        No system alerts recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
      {notificationHistory.map((n) => (
        <div
          key={n.id}
          className={`border rounded-lg px-4 py-3 text-sm ${NOTIF_TYPE_STYLES[n.type]}`}
        >
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 font-semibold mt-0.5 text-base">
              {NOTIF_TYPE_ICONS[n.type]}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{n.title}</div>
              {n.message && (
                <div className="opacity-80 text-sm mt-1 leading-relaxed">{n.message}</div>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              <span className="text-xs opacity-40 tabular-nums">
                {n.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                onClick={() => removeNotificationFromHistory(n.id)}
                className="opacity-30 hover:opacity-80 transition-opacity text-slate-400 hover:text-red-400"
                title="Delete alert"
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RoomHintPanel() {
  const { gameState } = useGameStore();
  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleId | null>(null);

  if (!gameState) return null;

  const roomPuzzles = Object.values(PUZZLES).filter(
    (p) => p.roomId === (gameState.currentRoom as RoomId)
  );

  if (roomPuzzles.length === 0) {
    return (
      <p className="text-slate-500 text-sm text-center py-6">
        No puzzles available in this room.
      </p>
    );
  }

  if (selectedPuzzle) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedPuzzle(null)}
          className="text-xs text-slate-500 hover:text-slate-300 underline"
        >
          ← Back to puzzles
        </button>
        <HintPanel puzzleId={selectedPuzzle} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-slate-500 text-xs mb-4">
        Select a puzzle to get hints for:
      </p>
      {roomPuzzles.map((puzzle) => {
        const puzzleState = gameState.puzzleStates[puzzle.id];
        const isSolved = puzzleState?.status === "SOLVED";
        return (
          <button
            key={puzzle.id}
            onClick={() => !isSolved && setSelectedPuzzle(puzzle.id as PuzzleId)}
            disabled={isSolved}
            className={`w-full px-4 py-3 border rounded text-left text-sm transition-colors
              ${isSolved
                ? "bg-slate-900/30 border-slate-800/30 text-slate-600 cursor-default"
                : "bg-slate-800/60 hover:bg-slate-700/60 border-slate-700/50 hover:border-slate-600/50 text-slate-300"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{puzzle.title}</span>
              {isSolved
                ? <span className="text-emerald-500 text-xs">✓ Solved</span>
                : <span className="text-slate-500 text-xs">{"★".repeat(puzzle.difficulty)}{"☆".repeat(5 - puzzle.difficulty)}</span>
              }
            </div>
            <p className="text-slate-500 text-xs mt-1 line-clamp-2">{puzzle.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function SavePanel() {
  const { gameState } = useGameStore();
  const { addNotification } = useUiStore();

  async function save(slot: 1 | 2 | 3) {
    if (!gameState) return;

    try {
      const res = await fetch("/api/game/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          slotNumber: slot,
          saveName: `Slot ${slot} — ${gameState.currentRoom.replace(/_/g, " ")}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addNotification({
          type: "success",
          title: "Game Saved",
          message: `Saved to Slot ${slot}`,
          duration: 3000,
        });
      }
    } catch {
      addNotification({ type: "error", title: "Save Failed", duration: 2000 });
    }
  }

  return (
    <div className="space-y-3">
      {([1, 2, 3] as const).map((slot) => (
        <button
          key={slot}
          onClick={() => save(slot)}
          className="w-full px-4 py-3 bg-slate-800/60 hover:bg-slate-700/60 border
                     border-slate-700/50 hover:border-slate-600/50 rounded text-left
                     text-sm text-slate-300 transition-colors"
        >
          <span className="font-medium">Save Slot {slot}</span>
          <span className="text-slate-600 ml-2 text-xs">— Click to save here</span>
        </button>
      ))}
    </div>
  );
}

const QUALITY_OPTIONS: { value: GraphicsQuality; label: string; description: string }[] = [
  { value: "low", label: "Low", description: "No bloom, no shadows, minimal particles. Best performance." },
  { value: "medium", label: "Medium", description: "Subtle bloom, limited shadows, moderate particles." },
  { value: "high", label: "High", description: "Full bloom, full shadows, maximum particles." },
];

function GraphicsSettingsPanel() {
  const { quality, setQuality } = useGraphicsStore();

  return (
    <div className="space-y-3">
      {QUALITY_OPTIONS.map((opt) => {
        const active = quality === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setQuality(opt.value)}
            className={`w-full px-4 py-3 border rounded text-left text-sm transition-colors
              ${active
                ? "bg-cyan-900/40 border-cyan-600/60 text-cyan-200"
                : "bg-slate-800/60 hover:bg-slate-700/60 border-slate-700/50 hover:border-slate-600/50 text-slate-300"
              }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{opt.label}</span>
              {active && <span className="text-cyan-400 text-xs">✓ Active</span>}
            </div>
            <p className="text-slate-500 text-xs mt-1">{opt.description}</p>
          </button>
        );
      })}
      <p className="text-slate-600 text-xs text-center pt-1">
        Takes effect immediately. Your choice is remembered on this device.
      </p>
    </div>
  );
}
