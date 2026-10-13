import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/api-helpers";
import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Magic-byte sniffing — Content-Type headers can be spoofed.
function sniffImage(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}

// POST /api/upload — webmaster-only image upload (products, banners, CMS).
export async function POST(req: NextRequest) {
  try {
    await requireRole(["OWNER", "ADMIN", "CONTENT_MANAGER", "ORDER_MANAGER"]);

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("No file provided.", 400);
    if (file.size > MAX_BYTES) return fail("Image exceeds the 5 MB limit.", 413);

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImage(buffer);
    if (!sniffed || !ALLOWED[sniffed]) {
      return fail("Only JPEG, PNG or WebP images are allowed.", 415);
    }

    const dir = path.join(process.cwd(), "public", "uploads");
    const name = `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ALLOWED[sniffed]}`;
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), buffer);
    } catch (fsErr) {
      // Serverless platforms (Vercel, Lambda) ship a read-only filesystem —
      // surface an actionable message instead of a generic 500.
      const code = (fsErr as NodeJS.ErrnoException)?.code;
      if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
        return fail(
          "File storage is read-only on this host (typical on Vercel). Upload the image to Vercel Blob / S3 / Cloudinary and paste its URL into the image field instead.",
          507,
        );
      }
      throw fsErr;
    }

    return ok({ url: `/uploads/${name}` }, 201);
  } catch (err) {
    return handleError(err);
  }
}
