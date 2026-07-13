"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/stores/gameStore";
import { useUiStore } from "@/stores/uiStore";
import { determineEnding, ENDINGS } from "@/lib/game/narrative";
import { Typewriter } from "./Typewriter";

export function EndingScreen() {
  const router = useRouter();
  const { gameState, reset } = useGameStore();
  const { closeModal } = useUiStore();

  if (!gameState) return null;

  const ending = ENDINGS[determineEnding(gameState)];

  function handlePlayAgain() {
    reset();
    closeModal();
    router.push("/");
  }

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-6 py-10 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
    >
      <div className="max-w-2xl w-full text-center space-y-6">
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-emerald-400 text-xs tracking-[0.3em] uppercase"
        >
          Escape Pod Launched
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="text-4xl sm:text-5xl font-bold text-slate-100 tracking-wide"
        >
          You Successfully Escaped
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="text-cyan-400 text-lg font-medium tracking-wide"
        >
          {ending.title}
        </motion.h2>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 1 }}
          className="text-slate-300 text-sm leading-relaxed text-left bg-slate-900/60 border border-slate-800/60 rounded-lg p-6 space-y-4"
        >
          <p>{ending.description}</p>
          <p className="text-slate-400 italic">
            <Typewriter text={ending.epilogue} speed={16} cursor={false} />
          </p>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4, duration: 0.8 }}
          onClick={handlePlayAgain}
          className="mt-2 px-8 py-3 bg-cyan-700/80 hover:bg-cyan-600 text-white rounded font-medium tracking-wide transition-colors"
        >
          Play Again
        </motion.button>
      </div>
    </motion.div>
  );
}
