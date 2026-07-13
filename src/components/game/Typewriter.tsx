"use client";

import { useEffect, useState, useRef } from "react";

interface TypewriterProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
  cursor?: boolean;
}

export function Typewriter({
  text,
  speed = 25,
  onComplete,
  className = "",
  cursor = true,
}: TypewriterProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const textRef = useRef(text);

  useEffect(() => {
    textRef.current = text;
    setDisplayed("");
    setDone(false);
    indexRef.current = 0;
  }, [text]);

  useEffect(() => {
    if (done) return;

    const interval = setInterval(() => {
      if (indexRef.current < textRef.current.length) {
        setDisplayed(textRef.current.slice(0, indexRef.current + 1));
        indexRef.current += 1;
      } else {
        setDone(true);
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [speed, done, onComplete]);

  return (
    <span className={className}>
      {displayed}
      {cursor && !done && (
        <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  );
}
