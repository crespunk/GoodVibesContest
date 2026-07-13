import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import type {
  GameState,
  RoomId,
  NpcId,
  ItemId,
  PuzzleId,
  DialogueMessage,
  GamePhase,
} from "@/types/game";

interface GameStore {
  // State
  gameState: GameState | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setGameState: (state: GameState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  moveToRoom: (roomId: RoomId) => void;
  addToInventory: (itemId: ItemId) => void;
  removeFromInventory: (itemId: ItemId) => void;
  setGamePhase: (phase: GamePhase) => void;
  markObjectInspected: (objectId: string) => void;
  updateNpcTrust: (npcId: NpcId, delta: number) => void;
  addNarrativeFlag: (flag: string) => void;
  addDialogueMessage: (npcId: NpcId, message: DialogueMessage) => void;
  markPuzzleSolved: (puzzleId: PuzzleId) => void;
  updateMoralScore: (delta: number) => void;
  clearActiveDialogue: () => void;
  reset: () => void;
}

const initialState = {
  gameState: null as GameState | null,
  isLoading: false,
  error: null as string | null,
};

export const useGameStore = create<GameStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      setGameState: (state) => set({ gameState: state, error: null }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      moveToRoom: (roomId) =>
        set((s) => {
          if (!s.gameState) return s;
          return {
            gameState: {
              ...s.gameState,
              currentRoom: roomId,
              visitedRooms: {
                ...s.gameState.visitedRooms,
                [roomId]: {
                  isVisited: true,
                  visitCount:
                    (s.gameState.visitedRooms[roomId]?.visitCount ?? 0) + 1,
                  firstVisitAt:
                    s.gameState.visitedRooms[roomId]?.firstVisitAt ??
                    new Date(),
                  inspectedObjects:
                    s.gameState.visitedRooms[roomId]?.inspectedObjects ?? [],
                  unlockedObjects:
                    s.gameState.visitedRooms[roomId]?.unlockedObjects ?? [],
                  discoveredClues:
                    s.gameState.visitedRooms[roomId]?.discoveredClues ?? [],
                },
              },
            },
          };
        }),

      addToInventory: (itemId) =>
        set((s) => {
          if (!s.gameState) return s;
          const existing = s.gameState.inventory.find((i) => i.itemId === itemId);
          if (existing) return s;
          return {
            gameState: {
              ...s.gameState,
              inventory: [
                ...s.gameState.inventory,
                {
                  itemId,
                  quantity: 1,
                  acquiredAt: new Date(),
                  acquiredFrom: s.gameState.currentRoom,
                },
              ],
            },
          };
        }),

      removeFromInventory: (itemId) =>
        set((s) => {
          if (!s.gameState) return s;
          return {
            gameState: {
              ...s.gameState,
              inventory: s.gameState.inventory.filter((i) => i.itemId !== itemId),
            },
          };
        }),

      setGamePhase: (phase) =>
        set((s) => {
          if (!s.gameState) return s;
          return { gameState: { ...s.gameState, gamePhase: phase } };
        }),

      markObjectInspected: (objectId) =>
        set((s) => {
          if (!s.gameState) return s;
          const roomId = s.gameState.currentRoom;
          const roomState = s.gameState.visitedRooms[roomId];
          if (roomState?.inspectedObjects.includes(objectId)) return s;
          return {
            gameState: {
              ...s.gameState,
              visitedRooms: {
                ...s.gameState.visitedRooms,
                [roomId]: {
                  ...roomState,
                  isVisited: true,
                  visitCount: roomState?.visitCount ?? 1,
                  firstVisitAt: roomState?.firstVisitAt ?? new Date(),
                  inspectedObjects: [
                    ...(roomState?.inspectedObjects ?? []),
                    objectId,
                  ],
                  unlockedObjects: roomState?.unlockedObjects ?? [],
                  discoveredClues: roomState?.discoveredClues ?? [],
                },
              },
            },
          };
        }),

      updateNpcTrust: (npcId, delta) =>
        set((s) => {
          if (!s.gameState) return s;
          const current = s.gameState.npcStates[npcId];
          const newTrust = Math.max(0, Math.min(100, (current?.trustLevel ?? 50) + delta));
          return {
            gameState: {
              ...s.gameState,
              ariaTrust: npcId === "ARIA_7" ? newTrust : s.gameState.ariaTrust,
              npcStates: {
                ...s.gameState.npcStates,
                [npcId]: {
                  ...current,
                  npcId,
                  trustLevel: newTrust,
                  disposition: current?.disposition ?? "NEUTRAL",
                  interactionCount: (current?.interactionCount ?? 0) + 1,
                  lastInteraction: new Date(),
                  sharedSecrets: current?.sharedSecrets ?? [],
                },
              },
            },
          };
        }),

      addNarrativeFlag: (flag) =>
        set((s) => {
          if (!s.gameState) return s;
          if (s.gameState.narrativeFlags.includes(flag)) return s;
          return {
            gameState: {
              ...s.gameState,
              narrativeFlags: [...s.gameState.narrativeFlags, flag],
            },
          };
        }),

      addDialogueMessage: (npcId, message) =>
        set((s) => {
          if (!s.gameState) return s;
          const activeDialogue = s.gameState.activeDialogue;
          if (activeDialogue?.npcId === npcId) {
            return {
              gameState: {
                ...s.gameState,
                activeDialogue: {
                  npcId,
                  history: [...activeDialogue.history, message],
                },
              },
            };
          }
          return {
            gameState: {
              ...s.gameState,
              activeDialogue: { npcId, history: [message] },
            },
          };
        }),

      markPuzzleSolved: (puzzleId) =>
        set((s) => {
          if (!s.gameState) return s;
          return {
            gameState: {
              ...s.gameState,
              puzzleStates: {
                ...s.gameState.puzzleStates,
                [puzzleId]: {
                  ...s.gameState.puzzleStates[puzzleId],
                  status: "SOLVED" as const,
                  solvedAt: new Date(),
                },
              },
            },
          };
        }),

      updateMoralScore: (delta) =>
        set((s) => {
          if (!s.gameState) return s;
          return {
            gameState: {
              ...s.gameState,
              moralScore: Math.max(
                0,
                Math.min(100, s.gameState.moralScore + delta)
              ),
            },
          };
        }),

      clearActiveDialogue: () =>
        set((s) => {
          if (!s.gameState) return s;
          return {
            gameState: { ...s.gameState, activeDialogue: undefined },
          };
        }),

      reset: () => set(initialState),
    })),
    { name: "game-store" }
  )
);
