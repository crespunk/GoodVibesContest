import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address").max(254),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be at most 24 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, _ and -"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});

// Accepts CUID v1 and v2 (Prisma v6 uses CUID v2 which doesn't pass z.string().cuid())
const sessionId = z.string().min(20).max(36);

export const submitPuzzleSchema = z.object({
  sessionId,
  puzzleId: z.string().min(1).max(64),
  answer: z.union([z.string().max(512), z.record(z.string(), z.string().max(256))]),
});

export const npcMessageSchema = z.object({
  sessionId,
  npcId: z.enum(["ARIA_7", "DR_CHEN", "MARCUS_WEBB", "DIRECTOR_PRICE"]),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(500, "Message too long — keep it under 500 characters"),
  roomId: z.string().min(1).max(64),
});

export const hintRequestSchema = z.object({
  sessionId,
  puzzleId: z.string().min(1).max(64),
});

export const moveRoomSchema = z.object({
  sessionId,
  targetRoom: z.string().min(1).max(64),
});

export const saveGameSchema = z.object({
  sessionId,
  slotNumber: z.number().int().min(1).max(3),
  saveName: z.string().max(50).optional(),
});

export const combineItemsSchema = z.object({
  sessionId,
  itemId1: z.string().min(1).max(64),
  itemId2: z.string().min(1).max(64),
});

export const choiceSchema = z.object({
  sessionId,
  choiceId: z.string().min(1).max(64),
  optionId: z.string().min(1).max(64),
});

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}
