// GET /api/uploads/[id] — public serving for database-stored media.
//
// Uploaded bytes live in the MediaAsset table (see /api/upload +
// src/lib/storage.ts) so this works identically on Vercel (read-only
// filesystem), local SQLite and any VPS. Images are never mutated — a
// re-upload creates a NEW row and URL — which is why the cache lifetime can
// be one year, immutable.

import { NextRequest } from "next/server";
import { loadImage } from "@/lib/storage";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const asset = await loadImage(id);
  if (!asset) {
    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const bytes = new Uint8Array(asset.data as Uint8Array);
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
