import { create } from "zustand";
import type { PuzzleId, NpcId, ItemId } from "@/types/game";

export type PanelType =
  | "inventory"
  | "map"
  | "hint"
  | "save"
  | "settings"
  | "notifications"
  | null;

export type ModalType =
  | "puzzle"
  | "dialogue"
  | "inspection"
  | "choice"
  | "ending"
  | "loading"
  | null;

interface UiStore {
  // Panels
  activePanel: PanelType;
  setActivePanel: (panel: PanelType) => void;
  togglePanel: (panel: PanelType) => void;

  // Modal
  activeModal: ModalType;
  activePuzzleId: PuzzleId | null;
  activeNpcId: NpcId | null;
  activeInspectionText: string | null;
  activeChoiceId: string | null;
  openPuzzleModal: (puzzleId: PuzzleId) => void;
  openDialogueModal: (npcId: NpcId) => void;
  openInspectionModal: (text: string) => void;
  openChoiceModal: (choiceId: string) => void;
  openEndingModal: () => void;
  closeModal: () => void;

  // Notifications
  notifications: Notification[];
  notificationHistory: NotificationRecord[];
  unreadNotificationCount: number;
  addNotification: (notification: Omit<Notification, "id">) => void;
  removeNotification: (id: string) => void;
  removeNotificationFromHistory: (id: string) => void;
  clearUnreadNotifications: () => void;

  // Item selection for combining
  selectedItemForCombine: ItemId | null;
  setSelectedItemForCombine: (itemId: ItemId | null) => void;

  // Ambient
  isSoundEnabled: boolean;
  toggleSound: () => void;

  // Typewriter
  isTyping: boolean;
  setIsTyping: (typing: boolean) => void;

  // Loading state
  isTransitioning: boolean;
  setIsTransitioning: (v: boolean) => void;
}

interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error" | "item";
  title: string;
  message?: string;
  duration?: number;
}

export interface NotificationRecord {
  id: string;
  type: "info" | "success" | "warning" | "error" | "item";
  title: string;
  message?: string;
  timestamp: Date;
}

let notifCounter = 0;

export const useUiStore = create<UiStore>()((set, get) => ({
  activePanel: null,
  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) =>
    set((s) => ({ activePanel: s.activePanel === panel ? null : panel })),

  activeModal: null,
  activePuzzleId: null,
  activeNpcId: null,
  activeInspectionText: null,
  activeChoiceId: null,

  openPuzzleModal: (puzzleId) =>
    set({ activeModal: "puzzle", activePuzzleId: puzzleId }),
  openDialogueModal: (npcId) =>
    set({ activeModal: "dialogue", activeNpcId: npcId }),
  openInspectionModal: (text) =>
    set({ activeModal: "inspection", activeInspectionText: text }),
  openChoiceModal: (choiceId) =>
    set({ activeModal: "choice", activeChoiceId: choiceId }),
  openEndingModal: () => set({ activeModal: "ending" }),
  closeModal: () =>
    set({
      activeModal: null,
      activePuzzleId: null,
      activeNpcId: null,
      activeInspectionText: null,
      activeChoiceId: null,
    }),

  notifications: [],
  notificationHistory: [],
  unreadNotificationCount: 0,
  addNotification: (notification) => {
    const id = `notif-${++notifCounter}`;
    const record: NotificationRecord = {
      id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      timestamp: new Date(),
    };
    set((s) => ({
      notifications: [...s.notifications, { ...notification, id }],
      notificationHistory: [record, ...s.notificationHistory],
      unreadNotificationCount: s.activePanel === "notifications" ? 0 : s.unreadNotificationCount + 1,
    }));
    const duration = notification.duration ?? 4000;
    setTimeout(() => get().removeNotification(id), duration);
  },
  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
  removeNotificationFromHistory: (id) =>
    set((s) => ({
      notificationHistory: s.notificationHistory.filter((n) => n.id !== id),
    })),
  clearUnreadNotifications: () => set({ unreadNotificationCount: 0 }),

  selectedItemForCombine: null,
  setSelectedItemForCombine: (itemId) =>
    set({ selectedItemForCombine: itemId }),

  isSoundEnabled: true,
  toggleSound: () => set((s) => ({ isSoundEnabled: !s.isSoundEnabled })),

  isTyping: false,
  setIsTyping: (isTyping) => set({ isTyping }),

  isTransitioning: false,
  setIsTransitioning: (isTransitioning) => set({ isTransitioning }),
}));
