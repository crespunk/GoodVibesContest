"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useUiStore } from "@/stores/uiStore";
import { getRoom } from "@/lib/game/rooms";
import { getNpc } from "@/lib/game/npcs";
import { ROOM_ORDER } from "@/lib/game/rooms";
import type { RoomId, NpcId } from "@/types/game";

const NAV_ICONS: Record<string, string> = {
  LOBBY: "🚪",
  SECURITY_OFFICE: "📺",
  RESEARCH_LAB: "🧪",
  SERVER_ROOM: "🖥️",
  EXECUTIVE_SUITE: "🏛️",
  ESCAPE_ROUTE: "🚀",
};

export function GameHUD() {
  const { gameState, moveToRoom } = useGameStore();
  const { togglePanel, activePanel, addNotification, setIsTransitioning, unreadNotificationCount, clearUnreadNotifications } =
    useUiStore();

  if (!gameState) return null;

  const room = getRoom(gameState.currentRoom as RoomId);
  const visitedRooms = Object.keys(gameState.visitedRooms) as RoomId[];

  async function handleRoomMove(targetRoom: RoomId) {
    if (!gameState || targetRoom === gameState.currentRoom) return;

    const currentRoom = getRoom(gameState.currentRoom as RoomId);
    const exit = currentRoom.exits.find((e) => e.to === targetRoom);
    if (!exit) {
      addNotification({
        type: "warning",
        title: "No Direct Path",
        message: "You can't go there directly from here.",
        duration: 2500,
      });
      return;
    }

    if (exit.isLocked) {
      if (exit.requiresItem) {
        const hasItem = gameState.inventory.some(
          (i) => i.itemId === exit.requiresItem
        );
        if (!hasItem) {
          addNotification({
            type: "warning",
            title: "Locked",
            message: exit.lockedMessage,
            duration: 3000,
          });
          return;
        }
      }
      if (exit.requiresPuzzleSolved) {
        const ps = gameState.puzzleStates[exit.requiresPuzzleSolved];
        if (ps?.status !== "SOLVED") {
          addNotification({
            type: "warning",
            title: "Locked",
            message: exit.lockedMessage,
            duration: 3000,
          });
          return;
        }
      }
    }

    setIsTransitioning(true);
    try {
      const res = await fetch("/api/game/room?action=move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: gameState.sessionId,
          targetRoom,
        }),
      });
      const data = await res.json();
      if (data.success) {
        moveToRoom(targetRoom);
        if (data.data.isFirstVisit && data.data.narrative) {
          addNotification({
            type: "info",
            title: room.name,
            message: data.data.narrative.slice(0, 100) + "...",
            duration: 6000,
          });
        }
      } else {
        addNotification({
          type: "warning",
          title: "Cannot Move",
          message: data.error,
          duration: 3000,
        });
      }
    } catch {
      addNotification({ type: "error", title: "Error", message: "Move failed.", duration: 3000 });
    } finally {
      setTimeout(() => setIsTransitioning(false), 600);
    }
  }

  const npcIds = room.availableNpcs as NpcId[];

  return (
    <>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="pointer-events-auto">
          <h1 className="text-cyan-400 font-mono text-sm font-semibold tracking-wider">
            ⬡ NEXUS PROTOCOL
          </h1>
          <p className="text-slate-500 text-xs">{room.name}</p>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {/* Status indicators */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  gameState.moralScore > 60
                    ? "bg-emerald-400"
                    : gameState.moralScore > 40
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
              />
              <span className="text-slate-500">
                Moral: {gameState.moralScore}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-slate-500">
                ARIA Trust: {gameState.ariaTrust}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">
                🎒 {gameState.inventory.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Left Sidebar — Room exits & navigation */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 pl-2">
        {room.exits.map((exit) => {
          const isAvailable =
            !exit.isLocked ||
            (exit.requiresItem &&
              gameState.inventory.some((i) => i.itemId === exit.requiresItem)) ||
            (exit.requiresPuzzleSolved &&
              gameState.puzzleStates[exit.requiresPuzzleSolved]?.status === "SOLVED");

          return (
            <motion.button
              key={exit.to}
              whileHover={{ x: 4 }}
              onClick={() => handleRoomMove(exit.to as RoomId)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-r-lg text-xs
                backdrop-blur-sm border-l border-t border-b transition-colors
                ${
                  isAvailable
                    ? "bg-slate-900/60 border-slate-700/50 text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    : "bg-slate-900/40 border-slate-800/30 text-slate-600"
                }
              `}
            >
              <span>{NAV_ICONS[exit.to] ?? "🚪"}</span>
              <span className="hidden sm:block">{exit.label}</span>
              {!isAvailable && <span className="text-slate-700">🔒</span>}
            </motion.button>
          );
        })}
      </div>

      {/* Right Sidebar — Actions */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2 pr-2">
        <SidebarButton
          icon="🎒"
          label="Inventory"
          active={activePanel === "inventory"}
          onClick={() => togglePanel("inventory")}
        />
        <SidebarButton
          icon="💡"
          label="Hints"
          active={activePanel === "hint"}
          onClick={() => togglePanel("hint")}
        />
        <SidebarButton
          icon="💾"
          label="Save"
          active={activePanel === "save"}
          onClick={() => togglePanel("save")}
        />
        <SidebarButton
          icon="🔔"
          label="Alerts"
          active={activePanel === "notifications"}
          badge={unreadNotificationCount}
          onClick={() => {
            togglePanel("notifications");
            clearUnreadNotifications();
          }}
        />

        {/* Available NPCs */}
        {npcIds.map((npcId) => {
          const npc = getNpc(npcId);
          return (
            <SidebarButton
              key={npcId}
              icon={npc.avatarGlyph}
              label={npc.name.split(" ")[0]}
              active={false}
              onClick={() => {
                useUiStore.getState().openDialogueModal(npcId);
              }}
              color={npc.avatarColor}
            />
          );
        })}
      </div>

      {/* Bottom Bar — Progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center pb-3 gap-2 pointer-events-none">
        {ROOM_ORDER.map((roomId) => {
          const visited = visitedRooms.includes(roomId);
          const current = gameState.currentRoom === roomId;
          return (
            <div
              key={roomId}
              className={`h-1 rounded-full transition-all duration-300 ${
                current
                  ? "w-6 bg-cyan-400"
                  : visited
                    ? "w-3 bg-slate-500"
                    : "w-2 bg-slate-800"
              }`}
            />
          );
        })}
      </div>
    </>
  );
}

interface SidebarButtonProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  badge?: number;
}

function SidebarButton({ icon, label, active, onClick, color, badge }: SidebarButtonProps) {
  return (
    <motion.button
      whileHover={{ x: -4 }}
      onClick={onClick}
      className={`
        relative flex items-center gap-2 px-3 py-2 rounded-l-lg text-xs
        backdrop-blur-sm border-r border-t border-b transition-colors
        ${
          active
            ? "bg-cyan-900/60 border-cyan-700/50 text-cyan-300"
            : "bg-slate-900/60 border-slate-700/50 text-slate-300 hover:bg-slate-800/80"
        }
      `}
    >
      <span className="hidden sm:block">{label}</span>
      <span style={{ color: color }}>{icon}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </motion.button>
  );
}
