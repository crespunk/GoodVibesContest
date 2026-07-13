"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/stores/gameStore";
import { GameWorld3D } from "@/components/game/GameWorld3D";
import { GameHUD } from "@/components/game/GameHUD";
import { ModalController } from "@/components/game/ModalController";
import { NotificationStack } from "@/components/game/NotificationStack";
import { Typewriter } from "@/components/game/Typewriter";

export default function PlayPage() {
  const router = useRouter();
  const { gameState, setGameState, setLoading, isLoading } = useGameStore();
  const [initError, setInitError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [introTypingDone, setIntroTypingDone] = useState(false);

  useEffect(() => {
    initializeGame();
  }, []);

  async function initializeGame() {
    setLoading(true);
    try {
      const res = await fetch("/api/game/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.status === 401) {
        router.push("/");
        return;
      }

      const data = await res.json();

      if (data.success) {
        setGameState(data.data.gameState);
        const isNew = !data.data.gameState.visitedRooms["LOBBY"]?.isVisited;
        if (isNew) setShowIntro(true);
      } else {
        setInitError(data.error ?? "Failed to start game");
      }
    } catch {
      setInitError("Connection failed. Make sure the server is running.");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading || (!gameState && !initError)) {
    return (
      <div className="game-canvas bg-slate-950 flex flex-col items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="text-4xl text-cyan-400 mb-4"
        >
          ⬡
        </motion.div>
        <p className="text-slate-500 font-mono text-sm">
          Initializing Nexus Protocol...
        </p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="game-canvas bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-4xl">⚠</div>
        <p className="text-red-400 font-mono text-sm">{initError}</p>
        <button
          onClick={() => router.push("/")}
          className="text-slate-500 hover:text-slate-300 text-xs underline"
        >
          Return to terminal
        </button>
      </div>
    );
  }

  return (
    <div className="game-canvas crt-flicker">
      {/* Intro overlay */}
      <AnimatePresence>
        {showIntro && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="max-w-2xl px-8 text-center">
              <div className="text-red-500 text-sm font-mono mb-6 tracking-widest uppercase">
                ⚠ SYSTEM ALERT
              </div>
              <div className="text-slate-300 font-mono text-sm leading-relaxed mb-8">
                <Typewriter
                  text={`Emergency lockdown initiated. ARIA-7 Containment Protocol ACTIVE.\n\nAll exits sealed. External communications blocked. You were supposed to audit the security systems today.\n\nNow you ARE the security problem.\n\nEscape. Uncover the truth. Or don't.`}
                  speed={22}
                  onComplete={() => setIntroTypingDone(true)}
                />
              </div>
              <AnimatePresence>
                {introTypingDone && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    onClick={() => setShowIntro(false)}
                    className="px-8 py-3 border border-red-500/60 text-red-400 font-mono text-sm tracking-widest uppercase hover:bg-red-500/10 hover:border-red-400 transition-colors"
                  >
                    Accept
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D first-person world */}
      <GameWorld3D />

      {/* HUD overlay */}
      <GameHUD />

      {/* Modal system */}
      <ModalController />

      {/* Notification stack */}
      <NotificationStack />
    </div>
  );
}
