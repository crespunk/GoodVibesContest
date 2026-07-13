"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showClose?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
  full: "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showClose = true,
  className = "",
}: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={`relative w-full ${sizeStyles[size]} bg-slate-900/95 border border-slate-700/50 rounded-lg shadow-2xl ${className}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {(title || showClose) && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                {title && (
                  <h2 className="text-slate-100 font-semibold text-lg tracking-wide">
                    {title}
                  </h2>
                )}
                {showClose && onClose && (
                  <button
                    onClick={onClose}
                    className="ml-auto text-slate-500 hover:text-slate-300 transition-colors text-xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
