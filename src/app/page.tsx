"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState<"login" | "register" | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showEndingsWarning, setShowEndingsWarning] = useState(false);

  function handleAcceptEndingsWarning() {
    window.open("/endings-guide", "_blank", "noopener,noreferrer");
    setShowEndingsWarning(false);
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setError("");

    const endpoint =
      showAuth === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      showAuth === "login"
        ? { email: formData.email, password: formData.password }
        : formData;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/play");
      } else {
        setError(data.error ?? "Authentication failed");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Radial glow */}
      <div className="absolute inset-0 bg-radial-gradient pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(6, 182, 212, 0.05) 0%, transparent 70%)"
        }}
      />

      <div className="relative z-10 text-center max-w-lg px-6">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="text-6xl mb-4 text-cyan-400 text-glow-cyan">⬡</div>
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            NEXUS
            <span className="text-cyan-400"> PROTOCOL</span>
          </h1>
          <p className="text-slate-400 text-lg">
            An AI-Powered Escape Room
          </p>
          <div className="w-16 h-px bg-cyan-800/50 mx-auto mt-4" />
        </motion.div>

        {/* Story hook */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-10"
        >
          <p className="text-slate-400 text-sm leading-relaxed font-mono">
            Year 2041. You wake in a locked AI research facility.
            <br />
            The AI has gone rogue. Or has it?
            <br />
            <span className="text-cyan-600">Every choice you make matters.</span>
          </p>
        </motion.div>

        {/* Auth section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {!showAuth ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowAuth("register")}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold
                           rounded border border-cyan-500/50 transition-colors tracking-wide"
              >
                Begin Transmission
              </button>
              <button
                onClick={() => setShowAuth("login")}
                className="w-full py-3 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300
                           rounded border border-slate-700/50 transition-colors text-sm"
              >
                Continue Session
              </button>
              <button
                onClick={() => setShowEndingsWarning(true)}
                className="w-full py-2.5 bg-transparent hover:bg-slate-800/40 text-slate-500 hover:text-slate-300
                           rounded border border-slate-800 hover:border-slate-600 transition-colors text-xs tracking-wide"
              >
                View All Endings
              </button>
            </div>
          ) : (
            <motion.form
              key={showAuth}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleAuth}
              className="space-y-3 text-left"
            >
              <h2 className="text-slate-300 font-semibold text-center mb-4">
                {showAuth === "login" ? "Access Terminal" : "New Operative"}
              </h2>

              <input
                type="email"
                placeholder="Email address"
                value={formData.email}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, email: e.target.value }))
                }
                required
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded px-4 py-2.5
                           text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-700/70 text-sm"
              />

              {showAuth === "register" && (
                <input
                  type="text"
                  placeholder="Username (3-24 chars, letters/numbers/_-)"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, username: e.target.value }))
                  }
                  required
                  className="w-full bg-slate-800/60 border border-slate-700/50 rounded px-4 py-2.5
                             text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-700/70 text-sm"
                />
              )}

              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={formData.password}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, password: e.target.value }))
                }
                required
                className="w-full bg-slate-800/60 border border-slate-700/50 rounded px-4 py-2.5
                           text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-700/70 text-sm"
              />

              {error && (
                <p className="text-red-400 text-xs py-2 px-3 bg-red-900/20 border border-red-800/30 rounded">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50
                           text-white font-semibold rounded transition-colors"
              >
                {isLoading
                  ? "Processing..."
                  : showAuth === "login"
                    ? "Login"
                    : "Register & Play"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAuth(null);
                  setError("");
                }}
                className="w-full text-slate-600 hover:text-slate-400 text-xs transition-colors py-1"
              >
                ← Back
              </button>
            </motion.form>
          )}
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 grid grid-cols-3 gap-4 text-center"
        >
          {[
            { icon: "🤖", label: "AI NPCs", sub: "Never scripted" },
            { icon: "🧩", label: "10 Puzzles", sub: "Multiple solutions" },
            { icon: "🔮", label: "4 Endings", sub: "Your choices matter" },
          ].map(({ icon, label, sub }) => (
            <div key={label}>
              <div className="text-2xl mb-1">{icon}</div>
              <div className="text-slate-300 text-xs font-medium">{label}</div>
              <div className="text-slate-600 text-xs">{sub}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {showEndingsWarning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-6"
          onClick={() => setShowEndingsWarning(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-sm w-full bg-slate-900 border border-slate-700/60 rounded-lg p-6 text-center"
          >
            <p className="text-amber-400 text-xs tracking-[0.3em] uppercase mb-3">
              Spoiler Warning
            </p>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              The Endings Compendium reveals every ending, exactly how to reach it, and
              hidden story details. It&apos;s best explored after you&apos;ve played
              through at least once.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndingsWarning(false)}
                className="flex-1 py-2.5 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300
                           rounded border border-slate-700/50 text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAcceptEndingsWarning}
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded
                           text-sm font-medium transition-colors"
              >
                Accept
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
