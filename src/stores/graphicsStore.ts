import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GraphicsQuality = "low" | "medium" | "high";

interface GraphicsStore {
  quality: GraphicsQuality;
  setQuality: (quality: GraphicsQuality) => void;
}

export const useGraphicsStore = create<GraphicsStore>()(
  persist(
    (set) => ({
      quality: "medium",
      setQuality: (quality) => set({ quality }),
    }),
    { name: "nexus-graphics-quality" }
  )
);
