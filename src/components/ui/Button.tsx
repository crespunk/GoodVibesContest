"use client";

import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

const variantStyles = {
  primary:
    "bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-500/50 shadow-lg shadow-cyan-900/30",
  secondary:
    "bg-slate-700/80 hover:bg-slate-600/80 text-slate-200 border border-slate-600/50",
  ghost:
    "bg-transparent hover:bg-white/5 text-slate-300 border border-transparent hover:border-slate-600/50",
  danger:
    "bg-red-900/80 hover:bg-red-800/80 text-red-200 border border-red-700/50",
  success:
    "bg-emerald-900/80 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-700/50",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading,
  leftIcon,
  rightIcon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || isLoading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={`
        inline-flex items-center justify-center gap-2 rounded font-medium
        transition-colors duration-150 focus:outline-none focus:ring-2
        focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]} ${sizeStyles[size]} ${className}
      `}
      disabled={disabled || isLoading}
      {...(props as object)}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </motion.button>
  );
}
