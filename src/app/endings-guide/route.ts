import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// Serves endings-guide.html, which lives at the project root (rather than
// under public/) so it stays easy to find and edit directly alongside the
// game's narrative data instead of being buried in the static assets folder.
export async function GET() {
  const filePath = path.join(process.cwd(), "endings-guide.html");
  const html = await readFile(filePath, "utf-8");
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
