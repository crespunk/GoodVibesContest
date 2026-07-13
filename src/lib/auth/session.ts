import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import type { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";
const SALT_ROUNDS = 12;

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  const cookie = req.cookies.get("auth_token");
  return cookie?.value ?? null;
}

export async function authenticateRequest(
  req: NextRequest
): Promise<JwtPayload | null> {
  try {
    const token = getTokenFromRequest(req);
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export async function createUser(
  email: string,
  username: string,
  password: string
) {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { email: email.toLowerCase(), username, passwordHash },
    select: { id: true, email: true, username: true },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
}
