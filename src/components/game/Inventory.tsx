"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useUiStore } from "@/stores/uiStore";
import { getItem } from "@/lib/game/items";
import { getCombinationResult } from "@/lib/game/items";
import type { ItemId } from "@/types/game";

export function Inventory() {
  const { gameState, addToInventory, removeFromInventory } = useGameStore();
  const { selectedItemForCombine, setSelectedItemForCombine, addNotification } =
    useUiStore();
  const [expandedItemId, setExpandedItemId] = useState<ItemId | null>(null);

  const inventory = gameState?.inventory ?? [];

  function toggleExpand(e: React.MouseEvent | React.KeyboardEvent, itemId: ItemId) {
    e.stopPropagation();
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  }

  async function handleItemClick(itemId: ItemId) {
    if (selectedItemForCombine === null) {
      setSelectedItemForCombine(itemId);
      return;
    }
    if (selectedItemForCombine === itemId) {
      setSelectedItemForCombine(null);
      return;
    }

    const firstItem = selectedItemForCombine;
    setSelectedItemForCombine(null);

    const result = getCombinationResult(firstItem, itemId);
    if (!result) {
      addNotification({
        type: "info",
        title: "No Combination",
        message: "These items don't combine.",
        duration: 2000,
      });
      return;
    }

    if (!gameState?.sessionId) return;
    try {
      const res = await fetch("/api/game/inventory?action=combine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: gameState.sessionId, itemId1: firstItem, itemId2: itemId }),
      });
      const data = await res.json();
      if (data.success && data.data.resultItemId) {
        removeFromInventory(firstItem);
        removeFromInventory(itemId);
        addToInventory(data.data.resultItemId);
        addNotification({
          type: "success",
          title: "Items Combined!",
          message: `Created: ${getItem(data.data.resultItemId).name}`,
          duration: 3000,
        });
      } else {
        addNotification({
          type: "info",
          title: "No Combination",
          message: "These items don't combine.",
          duration: 2000,
        });
      }
    } catch {
      addNotification({
        type: "error",
        title: "Error",
        message: "Combining items failed.",
        duration: 3000,
      });
    }
  }

  if (inventory.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        <span className="text-2xl block mb-2">🎒</span>
        Your inventory is empty.
        <br />
        Explore the room to find items.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selectedItemForCombine && (
        <div className="text-xs text-cyan-400 bg-cyan-900/20 border border-cyan-800/50 rounded px-3 py-2 mb-3">
          Combining: <strong>{getItem(selectedItemForCombine).name}</strong>
          <br />
          Click another item to combine, or click again to cancel.
        </div>
      )}

      <AnimatePresence>
        {inventory.map((entry) => {
          const item = getItem(entry.itemId);
          const isSelected = selectedItemForCombine === entry.itemId;
          const isExpanded = expandedItemId === entry.itemId;
          const isCombinable =
            selectedItemForCombine &&
            selectedItemForCombine !== entry.itemId &&
            getCombinationResult(selectedItemForCombine, entry.itemId) !== null;

          return (
            <motion.div
              key={entry.itemId}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              role="button"
              tabIndex={0}
              onClick={() => handleItemClick(entry.itemId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleItemClick(entry.itemId);
                }
              }}
              className={`
                w-full text-left p-3 rounded border transition-all duration-200 group cursor-pointer
                ${
                  isSelected
                    ? "bg-cyan-900/40 border-cyan-500/70 shadow-lg shadow-cyan-900/20"
                    : isCombinable
                      ? "bg-emerald-900/30 border-emerald-600/50 animate-pulse"
                      : "bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600/50"
                }
              `}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 text-sm font-medium truncate">
                      {item.name}
                    </span>
                    {item.isKey && (
                      <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-700/30 px-1.5 py-0.5 rounded flex-shrink-0">
                        KEY
                      </span>
                    )}
                    {entry.quantity > 1 && (
                      <span className="text-xs text-slate-500">
                        ×{entry.quantity}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-slate-400 text-xs mt-0.5 ${
                      isExpanded ? "" : "line-clamp-2"
                    }`}
                  >
                    {item.description}
                  </p>
                  {item.loreText && (
                    <p
                      className={`text-slate-500 text-xs mt-1 italic ${
                        isExpanded ? "" : "line-clamp-1"
                      }`}
                    >
                      {item.loreText}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(e, entry.itemId)}
                    className="text-cyan-500/70 hover:text-cyan-400 text-[10px] mt-1 underline underline-offset-2"
                  >
                    {isExpanded ? "Show less" : "Click to read more"}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {inventory.some((i) => getItem(i.itemId).canCombineWith?.length) && (
        <p className="text-xs text-slate-600 text-center pt-2">
          Click an item to select, then click another to combine.
        </p>
      )}
    </div>
  );
}
