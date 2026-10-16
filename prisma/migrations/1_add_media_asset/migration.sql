-- MediaAsset: database-backed media storage (v0.4.4).
-- Uploaded webmaster images are stored in the database (BYTEA) instead of the
-- server filesystem so hosts without a writable disk (Vercel/Lambda) work
-- exactly like local SQLite. Served publicly by /api/uploads/[id].
-- Applied automatically by `vercel-build` → scripts/prisma-deploy-db.cjs.

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);
