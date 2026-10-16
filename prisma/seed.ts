// MAISON ÉLAN — bootstrap seed v2 (idempotent, self-healing).
// ⚠️ Development/demo data. Seeded credentials are DEV-ONLY and publicly
// documented in README/INSTALLATION — never treat them as production secrets.
//
// ─── Why v2? ─────────────────────────────────────────────────────────────────
// v1 had a global guard: "if any user exists, skip everything". On databases
// that already contained rows (e.g. rows created manually / by an external SQL
// dump) the seed silently skipped and the store went live with an EMPTY
// catalog — the "seed tidak masuk database" incident.
//
// v2 semantics (safe for redeploys, useful for repairs):
//   DEFAULT      — "ensure exists": creates every missing seed row, keyed by
//                  natural key (email / slug / sku / code / id). EXISTING rows
//                  are never modified, so admin edits survive redeploys.
//                  SECURITY EXCEPTION (S-01): demo USERS are created only while
//                  the users table is EMPTY. Once any user exists, missing demo
//                  users are never re-created — a redeploy must never resurrect
//                  a publicly documented OWNER password.
//                  Exception: a demo account whose passwordHash is not a valid
//                  bcrypt hash (e.g. written by an external SQL dump) is
//                  REPAIRED automatically — login must always work.
//   SEED_FORCE=1 — additionally updates seed-owned rows (matched by natural
//                  key) to canonical values and resets demo passwords.
//                  Still deletes NOTHING. Use to repair a damaged demo install.
//   --verify     — read-only: prints per-table row counts, exits 1 when the
//                  schema is missing or the store is unexpectedly empty.
//                  Used by scripts/prisma-deploy-db.cjs as post-provision proof.
//
// Run:  bun prisma/seed.ts              (seed, honors SEED_FORCE env)
//       bun prisma/seed.ts --force      (same as SEED_FORCE=1)
//       bun prisma/seed.ts --verify     (read-only counts)
//       bun run db:seed (SQLite) · bun run db:seed:pg (PostgreSQL/Neon)

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { pathToFileURL } from "node:url";
import { DEFAULT_SETTINGS } from "../src/lib/store-settings";

const db = new PrismaClient();

/** Valid bcrypt hashes start with $2a/$2b/$2y + cost. Anything else is broken. */
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$/;

export interface SeedSummary {
  mode: "ensure" | "force";
  created: Record<string, number>;
  repaired: string[];
  counts: Record<string, number>;
}

export interface VerifyResult {
  counts: Record<string, number>;
  errors: string[];
  ok: boolean;
}

const DEMO_USERS = [
  { email: "owner@maisonelan.dev", password: "Maison2025!", name: "Amara Owner", role: "OWNER", phone: "+62 811 200 100" },
  { email: "orders@maisonelan.dev", password: "Staff2025!", name: "Rara Order", role: "ORDER_MANAGER", phone: null as string | null },
  { email: "customer@example.com", password: "Customer2025!", name: "Ayu Kartika", role: "CUSTOMER", phone: "+62 812 345 678" },
];

const CATEGORIES = [
  { slug: "handbags", name: "Handbags", imageUrl: "/images/cat-handbags.jpg", description: "Structured silhouettes in full-grain leather.", position: 1 },
  { slug: "jewelry", name: "Jewelry", imageUrl: "/images/cat-jewelry.jpg", description: "Recycled gold and freshwater pearls.", position: 2 },
  { slug: "apparel", name: "Apparel", imageUrl: "/images/cat-apparel.jpg", description: "Cashmere, silk and wool — cut to last.", position: 3 },
  { slug: "accessories", name: "Accessories", imageUrl: "/images/cat-accessories.jpg", description: "The finishing gesture.", position: 4 },
  { slug: "fragrance", name: "Fragrance", imageUrl: "/images/cat-fragrance.jpg", description: "Quiet scents, long memories.", position: 5 },
];

type V = { size?: string; color?: string; sku: string; stock: number; delta?: number };
interface P {
  slug: string;
  name: string;
  description: string;
  details: string;
  price: number; // IDR
  sale?: number;
  skuBase: string;
  material: string;
  images: string[];
  variants: V[];
  cats: string[];
  featured?: boolean;
  newArrival?: boolean;
  bestSeller?: boolean;
}

const PRODUCTS: P[] = [
  {
    slug: "elan-structured-tote", name: "Élan Structured Tote",
    description: "A sculpted everyday tote in vegetable-tanned cognac leather with brushed gold hardware. Opens wide, stands on its own, softens beautifully with wear.",
    details: "Full-grain vegetable-tanned leather\nSuede-lined interior with zip pocket\nH 30 × W 38 × D 14 cm\nMade in Bandung, Indonesia",
    price: 4290000, skuBase: "ME-TOTE-CGN", material: "Vegetable-tanned calf leather",
    images: ["/images/products/tote-cognac.jpg", "/images/cat-handbags.jpg"],
    variants: [
      { color: "Cognac", sku: "ME-TOTE-CGN", stock: 12 },
      { color: "Noir", sku: "ME-TOTE-NR", stock: 8 },
    ],
    cats: ["handbags"], featured: true, newArrival: true, bestSeller: true,
  },
  {
    slug: "aurele-shoulder-bag", name: "Aurèle Shoulder Bag",
    description: "A curved, minimalist shoulder bag in smooth black leather with a single elegant strap. The quiet hero of an evening wardrobe.",
    details: "Smooth calf leather\nMagnetic flap closure\nH 18 × W 26 × D 8 cm\nDust bag included",
    price: 3590000, sale: 2990000, skuBase: "ME-AUR-NR", material: "Smooth calf leather",
    images: ["/images/products/shoulder-bag-black.jpg"],
    variants: [{ color: "Noir", sku: "ME-AUR-NR", stock: 6 }],
    cats: ["handbags"], featured: true, bestSeller: true,
  },
  {
    slug: "mini-crossbody-lune", name: "Lune Mini Crossbody",
    description: "A petite crossbody on a delicate gold chain. Fits the phone, the card holder and nothing that doesn't spark joy.",
    details: "Pebbled calf leather\nGold-tone chain strap, 120 cm drop\nH 14 × W 20 × D 6 cm",
    price: 2490000, skuBase: "ME-LUNE-TAN", material: "Pebbled calf leather",
    images: ["/images/products/mini-crossbody.jpg"],
    variants: [{ color: "Camel", sku: "ME-LUNE-TAN", stock: 10 }],
    cats: ["handbags"], newArrival: true,
  },
  {
    slug: "collier-pendentif-or", name: "Collier Pendant Necklace",
    description: "A whisper-fine 18k gold chain holding a single hand-polished pendant. Layer it or let it speak alone.",
    details: "18k recycled gold\n45 cm chain with 2 cm extender\nHallmarked at clasp",
    price: 3290000, skuBase: "ME-COL-OR", material: "18k recycled gold",
    images: ["/images/products/gold-necklace.jpg", "/images/cat-jewelry.jpg"],
    variants: [
      { color: "Gold", sku: "ME-COL-OR45", stock: 15 },
      { color: "Gold", size: "50 cm", sku: "ME-COL-OR50", stock: 9, delta: 200000 * 100 },
    ],
    cats: ["jewelry"], featured: true, bestSeller: true,
  },
  {
    slug: "perle-drop-earrings", name: "Perle Drop Earrings",
    description: "Freshwater pearls suspended from hand-drawn gold hooks — weightless, luminous, inevitable.",
    details: "Freshwater pearls, 8 mm\n18k gold-filled hooks\nPair, presented in a lacquered box",
    price: 1590000, skuBase: "ME-PER-DRP", material: "Freshwater pearl, 18k gold-filled",
    images: ["/images/products/pearl-earrings.jpg"],
    variants: [{ color: "Ivory", sku: "ME-PER-DRP", stock: 18 }],
    cats: ["jewelry"], newArrival: true,
  },
  {
    slug: "manchette-cuff", name: "Manchette Cuff",
    description: "A sculptural brushed-gold cuff with a satin finish. Slips on, stays all day.",
    details: "Brushed 18k gold plating over brass\nOpen cuff, one size\nNickel-free",
    price: 1890000, skuBase: "ME-MAN-CUF", material: "18k gold-plated brass",
    images: ["/images/products/gold-cuff.jpg"],
    variants: [{ color: "Gold", sku: "ME-MAN-CUF", stock: 3 }],
    cats: ["jewelry"], featured: true,
  },
  {
    slug: "montre-classique", name: "Classique Watch",
    description: "A minimalist quartz watch with a cream dial, sapphire glass and cognac leather strap. Time, told quietly.",
    details: "Swiss quartz movement\n36 mm case, sapphire crystal\nItalian leather strap, quick-release",
    price: 4890000, skuBase: "ME-MON-CLQ", material: "Stainless steel, Italian leather",
    images: ["/images/products/watch-classic.jpg"],
    variants: [
      { color: "Cognac", sku: "ME-MON-CLQ-CG", stock: 7 },
      { color: "Noir", sku: "ME-MON-CLQ-NR", stock: 5 },
    ],
    cats: ["accessories"], bestSeller: true,
  },
  {
    slug: "lunettes-tortoise", name: "Solène Sunglasses",
    description: "Hand-polished tortoise acetate with warm gradient lenses. Five-barrel hinges, zero fuss.",
    details: "Italian acetate\nCAT-3 UV400 gradient lenses\nComes with leather case",
    price: 1450000, skuBase: "ME-SOL-TRT", material: "Italian acetate",
    images: ["/images/products/sunglasses.jpg", "/images/cat-accessories.jpg"],
    variants: [{ color: "Tortoise", sku: "ME-SOL-TRT", stock: 14 }],
    cats: ["accessories"], newArrival: true,
  },
  {
    slug: "foulard-soie", name: "Foulard Silk Scarf",
    description: "A 90 cm silk twill scarf with hand-rolled edges, printed in our atelier archive pattern.",
    details: "100% mulberry silk twill\n90 × 90 cm, hand-rolled hem\nDry clean only",
    price: 1190000, sale: 890000, skuBase: "ME-FOU-IVR", material: "Mulberry silk",
    images: ["/images/products/silk-scarf.jpg"],
    variants: [
      { color: "Ivory", sku: "ME-FOU-IVR", stock: 20 },
      { color: "Caramel", sku: "ME-FOU-CAR", stock: 11 },
    ],
    cats: ["accessories"],
  },
  {
    slug: "portefeuille-bifold", name: "Bifold Wallet",
    description: "A slim cognac bifold with suede interior — six cards, folded notes, nothing more.",
    details: "Vegetable-tanned leather, suede lining\n10 × 9.5 cm closed\nSix card slots",
    price: 990000, skuBase: "ME-POR-CGN", material: "Vegetable-tanned leather",
    images: ["/images/products/leather-wallet.jpg"],
    variants: [{ color: "Cognac", sku: "ME-POR-CGN", stock: 25 }],
    cats: ["accessories"],
  },
  {
    slug: "manteau-camel", name: "Manteau Camel Coat",
    description: "A double-breasted camel coat in Italian wool-cashmere. Tailored shoulder, relaxed fall — the season's defining layer.",
    details: "70% wool, 30% cashmere\nFully lined, horn buttons\nDry clean\nModel wears size M",
    price: 7990000, skuBase: "ME-MAN-CML", material: "Wool-cashmere",
    images: ["/images/products/wool-coat.jpg", "/images/cat-apparel.jpg"],
    variants: [
      { size: "S", color: "Camel", sku: "ME-MAN-CML-S", stock: 4 },
      { size: "M", color: "Camel", sku: "ME-MAN-CML-M", stock: 6 },
      { size: "L", color: "Camel", sku: "ME-MAN-CML-L", stock: 3 },
    ],
    cats: ["apparel"], featured: true, newArrival: true, bestSeller: true,
  },
  {
    slug: "pull-cachemire", name: "Pull Cashmere Crew",
    description: "A 12-gauge cashmere crew in warm oatmeal. Fine, dense, endlessly wearable.",
    details: "100% Inner Mongolian cashmere\n12-gauge knit\nHand wash cold or dry clean",
    price: 3190000, skuBase: "ME-PUL-OAT", material: "Cashmere",
    images: ["/images/products/cashmere-knit.jpg"],
    variants: [
      { size: "S", color: "Oatmeal", sku: "ME-PUL-OAT-S", stock: 8 },
      { size: "M", color: "Oatmeal", sku: "ME-PUL-OAT-M", stock: 10 },
      { size: "L", color: "Oatmeal", sku: "ME-PUL-OAT-L", stock: 7 },
    ],
    cats: ["apparel"], bestSeller: true,
  },
  {
    slug: "robe-soie-champagne", name: "Robe Silk Slip",
    description: "A bias-cut champagne silk slip with delicate straps. Falls like water, photographs like light.",
    details: "19-momme mulberry silk\nBias cut, adjustable straps\nDry clean",
    price: 3890000, skuBase: "ME-ROB-CHP", material: "Mulberry silk",
    images: ["/images/products/slip-dress.jpg"],
    variants: [
      { size: "XS", color: "Champagne", sku: "ME-ROB-CHP-XS", stock: 3 },
      { size: "S", color: "Champagne", sku: "ME-ROB-CHP-S", stock: 5 },
      { size: "M", color: "Champagne", sku: "ME-ROB-CHP-M", stock: 4 },
    ],
    cats: ["apparel"], featured: true, newArrival: true,
  },
  {
    slug: "eau-de-parfum-no1", name: "Eau de Parfum N°1",
    description: "Our signature scent: bergamot and fig leaf over sandalwood and white musk. 50 ml, bottled in frosted glass with a turned-wood cap.",
    details: "Eau de parfum, 22% concentration\nTop: bergamot, fig leaf\nHeart: iris, jasmine\nBase: sandalwood, white musk\n50 ml",
    price: 1790000, skuBase: "ME-PAR-50", material: "Eau de parfum",
    images: ["/images/products/fragrance.jpg", "/images/cat-fragrance.jpg"],
    variants: [
      { size: "50 ml", sku: "ME-PAR-50", stock: 16 },
      { size: "100 ml", sku: "ME-PAR-100", stock: 9, delta: 900000 * 100 },
    ],
    cats: ["fragrance"], bestSeller: true,
  },
];

const BANNERS = [
  {
    title: "The Autumn Atelier",
    subtitle: "Considered pieces in leather, silk and gold — made slowly, worn always.",
    imageUrl: "/images/hero-1.jpg",
    ctaText: "Shop the collection",
    ctaUrl: "/products",
    position: 1,
    isActive: true,
  },
  {
    title: "Objects of intent",
    subtitle: "Hand-finished leather goods, released in small series.",
    imageUrl: "/images/hero-2.jpg",
    ctaText: "Explore handbags",
    ctaUrl: "/collections/handbags",
    position: 2,
    isActive: true,
  },
];

const COURIERS = [
  {
    code: "NEX", name: "Nusantara Express", position: 1,
    description: "Next-day delivery across Java, 2–4 days outer islands.",
    minDays: 1, maxDays: 3,
    trackingUrlTemplate: "https://tracking.nusantara-express.example/?no={trackingNumber}",
    rates: [
      { name: "Reguler", type: "FLAT", region: "*", rate: 2000000, active: true }, // IDR 20.000
      { name: "Express Jakarta", type: "REGION", region: "DKI Jakarta", rate: 3500000, active: true },
    ],
  },
  {
    code: "SWFT", name: "SwiftLog", position: 2,
    description: "Reliable nationwide coverage with weekly pickup.",
    minDays: 2, maxDays: 5,
    trackingUrlTemplate: "https://swiftlog.example/track/{trackingNumber}",
    rates: [{ name: "Reguler", type: "FLAT", region: "*", rate: 1800000, active: true }],
  },
  {
    code: "KITA", name: "KurirKita Same Day", position: 3,
    description: "Same-day courier for Jabodetabek.",
    minDays: 0, maxDays: 1,
    trackingUrlTemplate: "",
    rates: [{ name: "Same Day Jabodetabek", type: "REGION", region: "DKI Jakarta", rate: 4000000, active: true }],
  },
];

const PAGES = (settings: { storeName: string; currency: string; contactEmail: string }) => [
  {
    slug: "faq", title: "Frequently Asked Questions", isPublished: true, showInFooter: true,
    content: `Answers to the questions our care team hears most. If yours isn't here, write to ${settings.contactEmail}.`,
  },
  {
    slug: "about-us", title: "About Us", isPublished: true, showInFooter: true,
    content: `## A house built on restraint\n\nMAISON ÉLAN began in a two-room atelier in Jakarta with a single belief: fewer, better things. We design leather goods, jewelry and apparel that are meant to be kept — repaired, re-worn, passed on.\n\n### Our materials\n- Vegetable-tanned leathers from tanneries audited for water treatment\n- 18k recycled gold, hallmarked in-house\n- Mulberry silk and Inner Mongolian cashmere from certified partners\n\n### Our pace\nWe release small series, not seasons. When a piece sells through, it returns only when the atelier can make it right.\n\n*Quiet luxury, considered everyday.*`,
  },
  {
    slug: "terms-and-conditions", title: "Terms & Conditions", isPublished: true, showInFooter: true,
    content: `By placing an order with ${settings.storeName} you agree to the terms below.\n\n### Orders\nAll orders are subject to acceptance and availability. Prices are shown in ${settings.currency} and include applicable taxes. We reserve the right to cancel orders in case of pricing errors, with full refund.\n\n### Payment\nPayment is completed by manual bank transfer using the instructions provided at checkout. Orders are prepared after payment verification, usually within one business day.\n\n### Liability\nOur liability for any claim relating to an order shall not exceed the purchase value of that order.`,
  },
  {
    slug: "privacy-policy", title: "Privacy Policy", isPublished: true, showInFooter: true,
    content: `We collect only what we need to serve you: your name, contact details, addresses and order history.\n\n### What we never do\n- We never sell your personal data.\n- We never store card numbers (we don't take cards online).\n- We never share your details with third parties beyond the courier delivering your order.\n\n### Your rights\nYou may request a copy or deletion of your personal data at any time by writing to ${settings.contactEmail}.`,
  },
  {
    slug: "shipping-policy", title: "Shipping Policy", isPublished: true, showInFooter: true,
    content: `### Dispatch\nOrders are dispatched from our Jakarta atelier after payment verification, typically within one business day. You will receive a tracking number by email and can follow progress on our Track Order page.\n\n### Carriers & rates\nWe work with insured domestic couriers. Rates are calculated at checkout based on your province and order value. Orders above the free-shipping threshold ship free.\n\n### Manual tracking\nTracking status on this site is updated manually by our operations team and may lag live courier data by a few hours. The courier's own tracking page always shows the most current scan.`,
  },
  {
    slug: "return-and-refund-policy", title: "Return & Refund Policy", isPublished: true, showInFooter: true,
    content: `### 7-day returns\nUnworn, unwashed pieces in original packaging may be returned within 7 days of delivery. Personalized and fragrance items are final sale once sealed.\n\n### How to return\n1. Write to ${settings.contactEmail} with your order number.\n2. We arrange pickup or provide a drop-off point.\n3. Refunds are issued to your bank account within 5 business days of receiving the return.\n\n### Faulty items\nIn the rare case of a fault, we repair, replace or refund — your choice — including return shipping.`,
  },
  {
    slug: "size-guide", title: "Size Guide", isPublished: true, showInFooter: false,
    content: `### Apparel (cm)\n| Size | Bust | Waist | Hip |\n| --- | --- | --- | --- |\n| XS | 80 | 62 | 88 |\n| S | 84 | 66 | 92 |\n| M | 88 | 70 | 96 |\n| L | 94 | 76 | 102 |\n\n### Bags\nDimensions are listed on every product page (height × width × depth).\n\n### Jewelry\nNecklaces come in 45 cm (choker-adjacent) and 50 cm (classic) lengths. Cuffs are one size, open style.`,
  },
];

const FAQS = [
  { question: "How do I pay for my order?", answer: "We use manual bank transfer. After checkout you receive the account details and your order number; your order is prepared once payment is verified (usually within one business day).", position: 1 },
  { question: "When will my order ship?", answer: "Orders verified before 15:00 WIB on business days are dispatched the same day. You will receive a tracking number as soon as the label is created.", position: 2 },
  { question: "Is the tracking on this site live?", answer: "Tracking status here is updated manually by our team and can lag the courier by a few hours. The courier's own tracking link (provided with your tracking number) is always current.", position: 3 },
  { question: "Can I return a piece?", answer: "Yes — unworn pieces in original packaging can be returned within 7 days of delivery. Fragrances are final sale once sealed. See our Return & Refund Policy.", position: 4 },
  { question: "Do you ship internationally?", answer: "Currently we ship within Indonesia. International shipping is available on request — write to care@maisonelan.example for a quote.", position: 5 },
  { question: "How do I care for leather pieces?", answer: "Keep away from direct sunlight, stuff with paper when storing, and condition twice a year with a neutral leather balm. Full care notes ship with every order.", position: 6 },
];

// ─── ensure helpers ──────────────────────────────────────────────────────────

async function ensureSettings(created: Record<string, number>) {
  await db.storeSetting.upsert({
    where: { id: "global" },
    // The settings JSON is admin-owned from the first save — never overwrite it.
    update: {},
    create: { id: "global", data: JSON.stringify(DEFAULT_SETTINGS) },
  });
  created.storeSettings = created.storeSettings ?? 0;
}

async function ensureUsers(force: boolean, created: Record<string, number>, repaired: string[]) {
  // SECURITY RULE (S-01): demo users are created ONLY on an empty users table
  // (first install of a demo store). If ANY user already exists (the buyer's
  // real owner, a renamed account, an external SQL dump), missing demo users
  // are NEVER created again — otherwise every redeploy would resurrect
  // `owner@maisonelan.dev` with its publicly documented password, silently
  // re-opening a known-credential OWNER login on a production store.
  // Existing demo accounts keep the invalid-hash self-heal + SEED_FORCE reset.
  const userCount = await db.user.count();
  for (const u of DEMO_USERS) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      if (userCount > 0) continue; // never resurrect documented credentials
      await db.user.create({
        data: {
          email: u.email,
          passwordHash: await bcrypt.hash(u.password, 10),
          name: u.name,
          role: u.role,
          phone: u.phone ?? undefined,
        },
      });
      created.users++;
      continue;
    }
    if (!BCRYPT_RE.test(existing.passwordHash)) {
      // Self-heal: an external SQL dump wrote an invalid hash — repair it so the
      // documented demo credentials work again. Real password changes always
      // produce valid bcrypt hashes, so this never overrides a deliberate edit.
      await db.user.update({
        where: { id: existing.id },
        data: { passwordHash: await bcrypt.hash(u.password, 10) },
      });
      repaired.push(`${u.email} (invalid bcrypt hash → reset to documented dev password)`);
      continue;
    }
    if (force) {
      await db.user.update({
        where: { id: existing.id },
        data: { passwordHash: await bcrypt.hash(u.password, 10) },
      });
      repaired.push(`${u.email} (SEED_FORCE → password reset to documented dev password)`);
    }
  }
}

async function ensureAddress(created: Record<string, number>) {
  const customer = await db.user.findUnique({ where: { email: "customer@example.com" } });
  if (!customer) return;
  const existing = await db.address.findUnique({ where: { id: "seed-addr-1" } });
  if (!existing) {
    await db.address.create({
      data: {
        id: "seed-addr-1",
        userId: customer.id,
        label: "Home",
        fullName: "Ayu Kartika",
        phone: "+62 812 345 678",
        line1: "Jl. Cendana Raya No. 21",
        line2: "Blok C2",
        city: "Jakarta Selatan",
        province: "DKI Jakarta",
        postalCode: "12430",
        country: "Indonesia",
        isDefault: true,
      },
    });
    created.addresses++;
  }
}

async function ensureCategories(force: boolean, created: Record<string, number>) {
  for (const c of CATEGORIES) {
    const existing = await db.category.findUnique({ where: { slug: c.slug } });
    if (!existing) {
      await db.category.create({ data: c });
      created.categories++;
    } else if (force) {
      await db.category.update({
        where: { id: existing.id },
        data: { name: c.name, imageUrl: c.imageUrl, description: c.description, position: c.position },
      });
    }
  }
}

async function ensureProducts(force: boolean, created: Record<string, number>) {
  const cats = await db.category.findMany({ select: { id: true, slug: true } });
  const catIdBySlug = new Map(cats.map((c) => [c.slug, c.id]));

  for (const p of PRODUCTS) {
    const data = {
      name: p.name,
      slug: p.slug,
      description: p.description,
      details: p.details,
      priceCents: p.price * 100,
      salePriceCents: p.sale ? p.sale * 100 : null,
      skuBase: p.skuBase,
      material: p.material,
      isFeatured: Boolean(p.featured),
      isNewArrival: Boolean(p.newArrival),
      isBestSeller: Boolean(p.bestSeller),
      isActive: true,
    };
    let product = await db.product.findUnique({ where: { slug: p.slug } });

    if (!product) {
      product = await db.product.create({
        data: {
          ...data,
          images: { create: p.images.map((url, i) => ({ url, alt: `${p.name} — view ${i + 1}`, position: i })) },
          variants: {
            create: p.variants.map((v) => ({
              size: v.size ?? null,
              color: v.color ?? null,
              sku: v.sku,
              stock: v.stock,
              priceDeltaCents: v.delta ?? 0,
            })),
          },
          categories: {
            create: p.cats
              .filter((slug) => catIdBySlug.has(slug))
              .map((slug) => ({ categoryId: catIdBySlug.get(slug) as string })),
          },
        },
      });
      created.products++;
      continue;
    }

    if (!force) continue; // admin-owned row — untouched in ensure mode

    await db.product.update({ where: { id: product.id }, data });

    // ensure variants by SKU
    for (const v of p.variants) {
      const variant = await db.productVariant.findUnique({ where: { sku: v.sku } });
      if (!variant) {
        await db.productVariant.create({
          data: {
            productId: product.id,
            size: v.size ?? null,
            color: v.color ?? null,
            sku: v.sku,
            stock: v.stock,
            priceDeltaCents: v.delta ?? 0,
          },
        });
      } else if (variant.productId !== product.id) {
        await db.productVariant.update({
          where: { id: variant.id },
          data: { productId: product.id, stock: v.stock, priceDeltaCents: v.delta ?? 0 },
        });
      }
    }

    // ensure images (missing url → create; keep admin ordering untouched)
    const images = await db.productImage.findMany({ where: { productId: product.id }, select: { url: true } });
    const have = new Set(images.map((i) => i.url));
    for (let i = 0; i < p.images.length; i++) {
      if (!have.has(p.images[i])) {
        await db.productImage.create({
          data: { productId: product.id, url: p.images[i], alt: `${p.name} — view ${i + 1}`, position: i },
        });
      }
    }

    // ensure category links
    for (const slug of p.cats) {
      const categoryId = catIdBySlug.get(slug);
      if (!categoryId) continue;
      const link = await db.productCategory.findUnique({
        where: { productId_categoryId: { productId: product.id, categoryId } },
        select: { productId: true },
      });
      if (!link) {
        await db.productCategory.create({ data: { productId: product.id, categoryId } });
      }
    }
  }
}

async function ensureBanners(force: boolean, created: Record<string, number>) {
  const count = await db.banner.count();
  if (count === 0) {
    await db.banner.createMany({ data: BANNERS });
    created.banners += BANNERS.length;
    return;
  }
  if (!force) return;
  for (const b of BANNERS) {
    const existing = await db.banner.findFirst({ where: { title: b.title }, select: { id: true } });
    if (!existing) {
      await db.banner.create({ data: b });
      created.banners++;
    }
  }
}

async function ensureCouriers(force: boolean, created: Record<string, number>) {
  for (const c of COURIERS) {
    let courier = await db.courier.findUnique({ where: { code: c.code } });
    if (!courier) {
      courier = await db.courier.create({
        data: {
          code: c.code,
          name: c.name,
          description: c.description,
          minDays: c.minDays,
          maxDays: c.maxDays,
          trackingUrlTemplate: c.trackingUrlTemplate || null,
          position: c.position,
          isActive: true,
        },
      });
      created.couriers++;
    } else if (force) {
      await db.courier.update({
        where: { id: courier.id },
        data: {
          name: c.name,
          description: c.description,
          minDays: c.minDays,
          maxDays: c.maxDays,
          trackingUrlTemplate: c.trackingUrlTemplate || null,
          position: c.position,
        },
      });
    }

    const rateCount = await db.shippingRate.count({ where: { courierId: courier.id } });
    if (rateCount === 0) {
      await db.shippingRate.createMany({
        data: c.rates.map((r) => ({
          courierId: courier!.id,
          name: r.name,
          type: r.type,
          region: r.region,
          rateCents: r.rate,
          isActive: r.active,
        })),
      });
      created.shippingRates += c.rates.length;
    } else if (force) {
      for (const r of c.rates) {
        const existing = await db.shippingRate.findFirst({
          where: { courierId: courier!.id, name: r.name },
          select: { id: true },
        });
        if (!existing) {
          await db.shippingRate.create({
            data: {
              courierId: courier!.id,
              name: r.name,
              type: r.type,
              region: r.region,
              rateCents: r.rate,
              isActive: r.active,
            },
          });
          created.shippingRates++;
        }
      }
    }
  }
}

async function ensurePages(force: boolean, created: Record<string, number>) {
  const settings = { storeName: "MAISON ÉLAN", currency: "IDR", contactEmail: DEFAULT_SETTINGS.contactEmail };
  for (const p of PAGES(settings)) {
    const existing = await db.contentPage.findUnique({ where: { slug: p.slug } });
    if (!existing) {
      await db.contentPage.create({ data: p });
      created.contentPages++;
    } else if (force) {
      await db.contentPage.update({
        where: { id: existing.id },
        data: { title: p.title, content: p.content, isPublished: p.isPublished, showInFooter: p.showInFooter },
      });
    }
  }
}

async function ensureFaqs(force: boolean, created: Record<string, number>) {
  const count = await db.faqEntry.count();
  if (count === 0) {
    await db.faqEntry.createMany({ data: FAQS });
    created.faqEntries += FAQS.length;
    return;
  }
  if (!force) return;
  for (const f of FAQS) {
    const existing = await db.faqEntry.findFirst({ where: { question: f.question }, select: { id: true } });
    if (!existing) {
      await db.faqEntry.create({ data: f });
      created.faqEntries++;
    }
  }
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Idempotent bootstrap seed. Creates missing seed rows; never deletes; never
 * touches admin-owned rows except the documented broken-hash repair (and,
 * with force=true, canonical repair of seed-owned rows).
 */
export async function runSeed(opts?: { force?: boolean }): Promise<SeedSummary> {
  const force = opts?.force ?? process.env.SEED_FORCE === "1";
  const created: Record<string, number> = {
    users: 0, addresses: 0, categories: 0, products: 0, banners: 0,
    couriers: 0, shippingRates: 0, contentPages: 0, faqEntries: 0,
  };
  const repaired: string[] = [];

  await ensureSettings(created);
  await ensureUsers(force, created, repaired);
  await ensureAddress(created);
  await ensureCategories(force, created);
  await ensureProducts(force, created);
  await ensureBanners(force, created);
  await ensureCouriers(force, created);
  await ensurePages(force, created);
  await ensureFaqs(force, created);

  const counts = await collectCounts();
  return { mode: force ? "force" : "ensure", created, repaired, counts };
}

/** Read-only row counts for the core content tables. Null = table missing. */
export async function collectCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const tables: [string, () => Promise<number>][] = [
    ["users", () => db.user.count()],
    ["categories", () => db.category.count()],
    ["products", () => db.product.count()],
    ["productVariants", () => db.productVariant.count()],
    ["banners", () => db.banner.count()],
    ["couriers", () => db.courier.count()],
    ["shippingRates", () => db.shippingRate.count()],
    ["contentPages", () => db.contentPage.count()],
    ["faqEntries", () => db.faqEntry.count()],
    ["storeSettings", () => db.storeSetting.count()],
  ];
  for (const [name, fn] of tables) {
    try {
      counts[name] = await fn();
    } catch {
      counts[name] = -1; // table missing / unreachable — surfaced by verifyDb()
    }
  }
  return counts;
}

/**
 * Post-provision verification: every core table must exist and the store must
 * have at least one user and one product (unless allowEmpty — e.g. a buyer who
 * deliberately deployed with SKIP_SEED=1 and will bootstrap via /webmaster/setup).
 */
export async function verifyDb(opts?: { allowEmpty?: boolean }): Promise<VerifyResult> {
  const counts = await collectCounts();
  const errors: string[] = [];

  for (const [name, n] of Object.entries(counts)) {
    if (n === -1) errors.push(`Table for "${name}" is missing or unreadable — schema not applied? Run the deploy so prisma migrate can sync it.`);
  }
  const reachable = Object.entries(counts).filter(([, n]) => n >= 0);
  if (reachable.length === 0 && errors.length === 0) {
    errors.push("Database returned no counts — connection or schema problem.");
  }
  const allowEmpty = opts?.allowEmpty ?? process.env.SEED_VERIFY_ALLOW_EMPTY === "1";
  if (!allowEmpty && errors.length === 0) {
    if ((counts.users ?? 0) === 0) errors.push("users table is EMPTY — no owner can log in. Re-run the seed (redeploy, or `bun prisma/seed.ts`) or bootstrap via /webmaster/setup.");
    if ((counts.products ?? 0) === 0) errors.push("products table is EMPTY — the storefront has nothing to sell. Re-run the seed (redeploy, or `bun prisma/seed.ts`).");
  }
  return { counts, errors, ok: errors.length === 0 };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function isMainModule(): boolean {
  try {
    const entry = process.argv[1];
    if (!entry) return false;
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes("--verify");
  const force = args.includes("--force") || process.env.SEED_FORCE === "1";

  (async () => {
    if (verifyOnly) {
      const result = await verifyDb();
      console.log("[seed:verify] row counts:");
      for (const [name, n] of Object.entries(result.counts)) {
        console.log(`   ${name.padEnd(15)} ${n < 0 ? "TABLE MISSING" : n}`);
      }
      for (const e of result.errors) console.error(`[seed:verify] ✗ ${e}`);
      console.log(result.ok ? "[seed:verify] ✅ database looks healthy." : "[seed:verify] ❌ verification failed.");
      await db.$disconnect();
      process.exit(result.ok ? 0 : 1);
    }

    console.log(`🌱 Seeding MAISON ÉLAN demo data (mode: ${force ? "FORCE — repair seed rows" : "ensure — fill what is missing"})…`);
    const summary = await runSeed({ force });
    const totalCreated = Object.values(summary.created).reduce((s, n) => s + n, 0);
    console.log(totalCreated === 0 && summary.repaired.length === 0
      ? "[seed] Nothing to do — every seed row already exists (admin data untouched)."
      : `[seed] Created ${totalCreated} row(s): ${Object.entries(summary.created).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(", ") || "—"}`);
    for (const r of summary.repaired) console.log(`[seed] repaired: ${r}`);
    console.log("[seed] Row counts:", JSON.stringify(summary.counts));
    console.log("✅ Seed complete. Demo credentials (dev-only):");
    console.log("   Owner:    owner@maisonelan.dev / Maison2025!");
    console.log("   Staff:    orders@maisonelan.dev / Staff2025!");
    console.log("   Customer: customer@example.com / Customer2025!");
    await db.$disconnect();
    process.exit(0);
  })().catch(async (e) => {
    console.error("[seed] FAILED:", e instanceof Error ? e.message : e);
    await db.$disconnect().catch(() => undefined);
    process.exit(1);
  });
}
