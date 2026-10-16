// POST /api/upload — webmaster image upload (products, banners, CMS pages).
//
// Restored in v0.4.4 with a DATABASE-backed sink (src/lib/storage.ts): the
// historical implementation wrote to public/uploads, which was both deleted
// from the codebase (leaving the upload UI pointing at a dead endpoint) and
// inherently broken on Vercel's read-only filesystem. Bytes now live in the
// MediaAsset table and are served publicly by /api/uploads/[id].
//
// Access: staff with the `media` capability (OWNER, ADMIN, CONTENT_MANAGER).
// Validation: 4 MiB cap (Vercel's serverless body limit is 4.5 MB) and
// magic-byte sniffing for JPEG/PNG/WebP — Content-Type headers can be spoofed.

import { NextRequest } from "next/server";
import { audit } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { saveImage } from "@/lib/storage";
import { requireStaff } from "../webmaster/helpers";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MiB — fits Vercel's 4.5 MB body envelope

// Magic-byte sniffing — Content-Type headers can be spoofed.
function sniffImage(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff("media");

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("No file provided.", 400);
    if (file.size === 0) return fail("The uploaded file is empty.", 400);
    if (file.size > MAX_BYTES) return fail("Image exceeds the 4 MB limit.", 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(buffer);
    if (!mime) return fail("Only JPEG, PNG or WebP images are allowed.", 415);

    const stored = await saveImage(buffer, mime);
    await audit(staff, "MEDIA_UPLOAD", "MediaAsset", stored.id, { mime: stored.mime, size: stored.size });
    return ok({ url: stored.url }, 201);
  } catch (err) {
    return handleError(err);
  }
}
