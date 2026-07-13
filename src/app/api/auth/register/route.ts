import { NextRequest, NextResponse } from "next/server";
import { registerSchema, sanitizeInput } from "@/lib/utils/validation";
import { createUser, signToken } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, username, password } = parsed.data;
    const sanitizedEmail = sanitizeInput(email.toLowerCase());
    const sanitizedUsername = sanitizeInput(username);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: sanitizedEmail }, { username: sanitizedUsername }],
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error:
            existing.email === sanitizedEmail
              ? "Email already registered"
              : "Username already taken",
        },
        { status: 409 }
      );
    }

    const user = await createUser(sanitizedEmail, sanitizedUsername, password);
    const token = signToken({
      userId: user.id,
      email: user.email,
      username: user.username,
    });

    const response = NextResponse.json(
      { success: true, data: { user, token } },
      { status: 201 }
    );

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { success: false, error: "Registration failed" },
      { status: 500 }
    );
  }
}
