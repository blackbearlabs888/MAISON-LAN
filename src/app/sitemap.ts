import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/track`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/pages/about-us`, changeFrequency: "monthly", priority: 0.5 },
  ];

  let productRoutes: MetadataRoute.Sitemap = [];
  let categoryRoutes: MetadataRoute.Sitemap = [];
  let pageRoutes: MetadataRoute.Sitemap = [];
  try {
    const [products, categories, pages] = await Promise.all([
      db.product.findMany({ where: { isActive: true, archivedAt: null }, select: { slug: true, updatedAt: true } }),
      db.category.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
      db.contentPage.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    ]);
    productRoutes = products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
    categoryRoutes = categories.map((c) => ({
      url: `${base}/collections/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
    pageRoutes = pages
      .filter((p) => p.slug !== "about-us")
      .map((p) => ({
        url: `${base}/pages/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.3,
      }));
  } catch {
    // DB not ready — return static routes only
  }

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...pageRoutes];
}
