import Groq from "groq-sdk";

let client: Groq | null = null;

export function getGroqClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY environment variable is not set");
    client = new Groq({ apiKey });
  }
  return client;
}

export const AI_CONFIG = {
  // Free, fast, high-quality. Alternatives: "llama-3.1-8b-instant" (faster)
  model: "llama-3.3-70b-versatile" as const,
  maxTokens: 512,
  npcMaxTokens: 400,
  hintMaxTokens: 300,
  narrativeMaxTokens: 256,
  summaryMaxTokens: 512,
  temperature: 0.8,
} as const;

export type GroqMessage = { role: "system" | "user" | "assistant"; content: string };
