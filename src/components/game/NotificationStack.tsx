"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useUiStore } from "@/stores/uiStore";

const TYPE_STYLES = {
  info: "border-slate-600/50 bg-slate-800/90 text-slate-200",
  success: "border-emerald-700/50 bg-emerald-950/90 text-emerald-200",
  warning: "border-amber-700/50 bg-amber-950/90 text-amber-200",
  error: "border-red-700/50 bg-red-950/90 text-red-200",
  item: "border-cyan-700/50 bg-cyan-950/90 text-cyan-200",
};

const TYPE_ICONS = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  error: "✕",
  item: "✦",
};

export function NotificationStack() {
  const { notifications, removeNotification } = useUiStore();

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence initial={false}>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            className={`
              pointer-events-auto border rounded-lg px-4 py-3 shadow-xl
              backdrop-blur-md text-sm cursor-pointer
              ${TYPE_STYLES[n.type]}
            `}
            onClick={() => removeNotification(n.id)}
          >
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 font-semibold">
                {TYPE_ICONS[n.type]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{n.title}</div>
                {n.message && (
                  <div className="opacity-80 text-xs mt-0.5 line-clamp-2">
                    {n.message}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
