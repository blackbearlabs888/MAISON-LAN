// MAISON ÉLAN — media storage adapter (decision D-10).
// ─────────────────────────────────────────────────────────────────────────────
// Uploaded webmaster images are stored IN THE DATABASE (MediaAsset.data) and
// served publicly by /api/uploads/[id] with immutable caching.
//
// Why the database instead of the filesystem? Serverless platforms (Vercel,
// Lambda) ship a READ-ONLY filesystem — the historical `public/uploads` sink
// returned 507 there, so uploads were effectively Vercel-hostile. The database
// sink behaves identically on Vercel + Neon Postgres, local SQLite and any VPS
// with zero configuration, and it is included in ordinary DB backups
// (pg_dump / SQLite file) so media and the rows that reference them can never
// drift apart.
//
// Swapping sinks: implement `saveImage()` with your own adapter (Vercel Blob,
// S3, Cloudinary) and return an absolute URL — every image field accepts full
// URLs, and no other file needs to change.
//
// Validation lives in /api/upload (magic-byte sniffing, 4 MiB cap — Vercel's
// serverless body limit is 4.5 MB); this module is persistence only.

import { db } from "@/lib/db";

export interface StoredImage {
  /** Public URL the client should persist in the image field. */
  url: string;
  /** Identifier of the stored asset (MediaAsset row). */
  id: string;
  /** Effective MIME type (magic-byte sniffed). */
  mime: string;
  /** Size in bytes. */
  size: number;
}

export async function saveImage(buffer: Buffer, mime: string): Promise<StoredImage> {
  const asset = await db.mediaAsset.create({
    data: { mime, size: buffer.length, data: buffer },
  });
  return { url: `/api/uploads/${asset.id}`, id: asset.id, mime, size: buffer.length };
}

export async function loadImage(id: string) {
  return db.mediaAsset.findUnique({
    where: { id },
    select: { mime: true, size: true, data: true },
  });
}
