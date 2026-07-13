"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useUiStore } from "@/stores/uiStore";
import { getRoom } from "@/lib/game/rooms";
import { getItem } from "@/lib/game/items";
import { Typewriter } from "./Typewriter";
import type { RoomId, ItemId, PuzzleId, NpcId } from "@/types/game";

export function Room() {
  const { gameState, addToInventory, markObjectInspected, setGamePhase } =
    useGameStore();
  const {
    openPuzzleModal,
    openDialogueModal,
    openInspectionModal,
    addNotification,
    isTransitioning,
  } = useUiStore();

  const [examining, setExamining] = useState<string | null>(null);
  const [examineDescription, setExamineDescription] = useState<string>("");
  const [loadingObject, setLoadingObject] = useState<string | null>(null);
  const [loadingInteraction, setLoadingInteraction] = useState<string | null>(null);
  const [showFirstVisit, setShowFirstVisit] = useState(false);
  const [firstVisitText, setFirstVisitText] = useState("");

  if (!gameState) return null;

  const room = getRoom(gameState.currentRoom as RoomId);
  const roomState = gameState.visitedRooms[gameState.currentRoom as RoomId];
  const inspectedObjects = roomState?.inspectedObjects ?? [];

  async function handleObjectClick(objectId: string) {
    if (!gameState || loadingObject) return;

    const obj = room.objects.find((o) => o.id === objectId);
    if (!obj) return;

    if (obj.requiresItem) {
      const hasItem = gameState.inventory.some((i) => i.itemId === obj.requiresItem);
      if (!hasItem) {
        addNotification({
          type: "warning",
          title: "Locked",
          message: `You need ${getItem(obj.requiresItem as ItemId).name} to access this.`,
          duration: 3000,
        });
        return;
      }
    }

    if (obj.requiresPuzzleSolved) {
      const ps = gameState.puzzleStates[obj.requiresPuzzleSolved as PuzzleId];
      if (ps?.status !== "SOLVED") {
        addNotification({
          type: "warning",
          title: "Not yet accessible",
          message: "Solve a related puzzle first.",
          duration: 3000,
        });
        return;
      }
    }

    // If already examining this object, close the panel
    if (examining === objectId) {
      setExamining(null);
      return;
    }

    setLoadingObject(objectId);

    try {
      const res = await fetch("/api/game/room?action=inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          roomId: gameState.currentRoom,
          objectId,
          // No interactionId — just open the panel
        }),
      });

      const data = await res.json();

      if (data.success) {
        markObjectInspected(objectId);
        setExamineDescription(data.data.examineText);
        setExamining(objectId);
      }
    } catch {
      addNotification({
        type: "error",
        title: "Error",
        message: "Failed to interact.",
        duration: 3000,
      });
    } finally {
      setLoadingObject(null);
    }
  }

  async function handleInteraction(objectId: string, interactionId: string) {
    if (!gameState || loadingInteraction) return;

    setLoadingInteraction(interactionId);

    try {
      const res = await fetch("/api/game/room?action=inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          roomId: gameState.currentRoom,
          objectId,
          interactionId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const { examineText, itemObtained, puzzleTriggered, npcTriggered } = data.data;

        if (itemObtained) {
          addToInventory(itemObtained as ItemId);
          addNotification({
            type: "item",
            title: "Item Added to Inventory",
            message: `Found: ${getItem(itemObtained as ItemId).name}`,
            duration: 4000,
          });
        }

        if (puzzleTriggered) {
          setExamining(null);
          openPuzzleModal(puzzleTriggered as PuzzleId);
        } else if (npcTriggered) {
          setExamining(null);
          openDialogueModal(npcTriggered as NpcId);
        } else {
          openInspectionModal(examineText);
        }
      }
    } catch {
      addNotification({
        type: "error",
        title: "Error",
        message: "Failed to interact.",
        duration: 3000,
      });
    } finally {
      setLoadingInteraction(null);
    }
  }

  const visibleObjects = room.objects.filter((obj) => {
    if (!obj.isHidden) return true;
    if (obj.requiresPuzzleSolved) {
      const ps = gameState.puzzleStates[obj.requiresPuzzleSolved as PuzzleId];
      return ps?.status === "SOLVED";
    }
    return inspectedObjects.includes(obj.id);
  });

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence mode="wait">
        {!isTransitioning && (
          <motion.div
            key={room.id}
            className={`absolute inset-0 bg-gradient-to-br ${room.backgroundGradient}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Scan-line effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-transparent bg-[length:100%_4px] pointer-events-none opacity-20" />

            {/* Room description overlay */}
            <div className="absolute top-0 left-0 right-0 p-4">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-slate-400 text-xs font-mono leading-relaxed max-w-2xl"
              >
                {room.ambientDescription}
              </motion.div>
            </div>

            {/* Interactive objects */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full max-w-4xl h-96">
                {visibleObjects.map((obj, i) => {
                  const isInspected = inspectedObjects.includes(obj.id);
                  const isLoading = loadingObject === obj.id;

                  return (
                    <motion.button
                      key={obj.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                      style={{
                        left: `${obj.position.x}%`,
                        top: `${obj.position.y}%`,
                      }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => handleObjectClick(obj.id)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className={`relative flex flex-col items-center gap-1`}>
                        {/* Glow for important objects */}
                        {obj.hasGlow && !isInspected && (
                          <div
                            className="absolute inset-0 rounded-full blur-lg opacity-60 animate-pulse"
                            style={{ backgroundColor: room.accentColor }}
                          />
                        )}

                        {/* Object icon */}
                        <div
                          className={`
                            relative text-3xl p-3 rounded-lg backdrop-blur-sm transition-all duration-200
                            border cursor-pointer select-none
                            ${
                              isLoading
                                ? "animate-pulse border-cyan-500/70 bg-cyan-900/30"
                                : isInspected
                                  ? "border-slate-700/30 bg-slate-900/20 opacity-60"
                                  : "border-slate-600/50 bg-slate-900/40 group-hover:border-cyan-500/70 group-hover:bg-slate-800/60"
                            }
                          `}
                        >
                          {isLoading ? (
                            <span className="inline-block w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            obj.icon
                          )}

                          {/* Inspect indicator */}
                          {!isInspected && !isLoading && (
                            <span
                              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse"
                              style={{ backgroundColor: room.accentColor }}
                            />
                          )}
                        </div>

                        {/* Object label */}
                        <div
                          className={`
                            text-xs px-2 py-0.5 rounded backdrop-blur-sm transition-all
                            opacity-0 group-hover:opacity-100 whitespace-nowrap
                            bg-slate-900/80 text-slate-200 border border-slate-700/50
                          `}
                        >
                          {obj.name}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Object interaction panel */}
            <AnimatePresence>
              {examining && (() => {
                const obj = room.objects.find((o) => o.id === examining);
                if (!obj) return null;

                const availableInteractions = obj.interactions.filter((interaction) => {
                  if (!interaction.requiresPuzzleSolved) return true;
                  const ps = gameState.puzzleStates[interaction.requiresPuzzleSolved as PuzzleId];
                  return ps?.status === "SOLVED";
                });

                return (
                  <motion.div
                    key={examining}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 top-0 h-full w-72 bg-slate-900/95 border-l border-slate-700/50 flex flex-col overflow-hidden"
                  >
                    {/* Panel header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{obj.icon}</span>
                        <span className="text-slate-200 text-sm font-semibold">{obj.name}</span>
                      </div>
                      <button
                        onClick={() => setExamining(null)}
                        className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Examine text */}
                    <div className="px-4 py-3 border-b border-slate-800/60">
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {examineDescription}
                      </p>
                    </div>

                    {/* Interaction buttons */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                      {availableInteractions.length === 0 ? (
                        <p className="text-slate-600 text-xs text-center py-4">
                          Nothing else to do here.
                        </p>
                      ) : (
                        availableInteractions.map((interaction) => (
                          <button
                            key={interaction.id}
                            onClick={() => handleInteraction(obj.id, interaction.id)}
                            disabled={loadingInteraction === interaction.id}
                            className="w-full text-left px-3 py-2.5 rounded border border-slate-700/50 bg-slate-800/50
                                       hover:bg-slate-700/60 hover:border-slate-600/60 text-slate-300 text-xs
                                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {loadingInteraction === interaction.id ? (
                              <span className="w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            ) : (
                              <span className="text-slate-500">›</span>
                            )}
                            {interaction.label}
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Corner atmospheric elements */}
            <div className="absolute bottom-4 right-4 text-slate-700 text-xs font-mono">
              [{room.name}]
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
