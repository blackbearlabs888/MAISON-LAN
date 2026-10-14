// Development/demo seed — realistic fictional data for MAISON ÉLAN.
// ⚠️ Development/demo only. Seeded credentials are NOT production defaults.
// Run: bun run db:seed (SQLite) · bun run db:seed:pg (PostgreSQL/Neon)
// Also runs automatically inside Vercel builds (scripts/prisma-deploy-db.cjs) —
// but ONLY against an empty database: the guard below never lets a redeploy
// overwrite existing users, products or admin-edited content.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // ── safety guard: only seed an EMPTY database ──
  // The deploy pipeline runs this seed on every release. If the store already
  // has accounts (real data or a previous seed), skip — admin edits must never
  // be overwritten by a redeploy. Set SEED_FORCE=1 to opt out of the guard.
  const userCount = await db.user.count();
  if (userCount > 0 && process.env.SEED_FORCE !== "1") {
    console.log(`[seed] Database already has ${userCount} user(s) — seed skipped.`);
    console.log("[seed] Seeding only fills an EMPTY database so production edits are never overwritten.");
    console.log("[seed] Force a re-seed with the env var SEED_FORCE=1 (fills missing rows, deletes nothing).");
    return;
  }

  console.log("🌱 Seeding MAISON ÉLAN development data…");

  // ── settings singleton ──
  const settings = await import("../src/lib/store-settings").then((m) => m.DEFAULT_SETTINGS);
  await db.storeSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", data: JSON.stringify(settings) },
  });

  // ── staff & demo customer (dev-only credentials, documented in README) ──
  const ownerHash = await bcrypt.hash("Maison2025!", 10);
  const owner = await db.user.upsert({
    where: { email: "owner@maisonelan.dev" },
    update: {},
    create: {
      email: "owner@maisonelan.dev",
      passwordHash: ownerHash,
      name: "Amara Owner",
      role: "OWNER",
      phone: "+62 811 200 100",
    },
  });

  const staffHash = await bcrypt.hash("Staff2025!", 10);
  await db.user.upsert({
    where: { email: "orders@maisonelan.dev" },
    update: {},
    create: {
      email: "orders@maisonelan.dev",
      passwordHash: staffHash,
      name: "Rara Order",
      role: "ORDER_MANAGER",
    },
  });

  const custHash = await bcrypt.hash("Customer2025!", 10);
  const customer = await db.user.upsert({
    where: { email: "customer@example.com" },
    update: {},
    create: {
      email: "customer@example.com",
      passwordHash: custHash,
      name: "Ayu Kartika",
      role: "CUSTOMER",
      phone: "+62 812 345 678",
    },
  });

  await db.address.upsert({
    where: { id: "seed-addr-1" },
    update: {},
    create: {
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

  // ── categories ──
  const catData = [
    { slug: "handbags", name: "Handbags", imageUrl: "/images/cat-handbags.jpg", description: "Structured silhouettes in full-grain leather.", position: 1 },
    { slug: "jewelry", name: "Jewelry", imageUrl: "/images/cat-jewelry.jpg", description: "Recycled gold and freshwater pearls.", position: 2 },
    { slug: "apparel", name: "Apparel", imageUrl: "/images/cat-apparel.jpg", description: "Cashmere, silk and wool — cut to last.", position: 3 },
    { slug: "accessories", name: "Accessories", imageUrl: "/images/cat-accessories.jpg", description: "The finishing gesture.", position: 4 },
    { slug: "fragrance", name: "Fragrance", imageUrl: "/images/cat-fragrance.jpg", description: "Quiet scents, long memories.", position: 5 },
  ];
  const cats: Record<string, { id: string }> = {};
  for (const c of catData) {
    cats[c.slug] = await db.category.upsert({
      where: { slug: c.slug },
      update: { imageUrl: c.imageUrl, description: c.description, position: c.position },
      create: c,
    });
  }

  // ── products ──
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

  const products: P[] = [
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

  for (const p of products) {
    const existing = await db.product.findUnique({ where: { slug: p.slug } });
    if (existing) continue; // idempotent seed
    await db.product.create({
      data: {
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
        categories: { create: p.cats.map((slug) => ({ categoryId: cats[slug].id })) },
      },
    });
  }

  // ── banners ──
  const bannerCount = await db.banner.count();
  if (bannerCount === 0) {
    await db.banner.createMany({
      data: [
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
      ],
    });
  }

  // ── couriers + rates ──
  const couriers = [
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
  for (const c of couriers) {
    const existing = await db.courier.findUnique({ where: { code: c.code } });
    if (existing) continue;
    await db.courier.create({
      data: {
        code: c.code,
        name: c.name,
        description: c.description,
        minDays: c.minDays,
        maxDays: c.maxDays,
        trackingUrlTemplate: c.trackingUrlTemplate || null,
        position: c.position,
        isActive: true,
        rates: {
          create: c.rates.map((r) => ({
            name: r.name,
            type: r.type,
            region: r.region,
            rateCents: r.rate,
            isActive: r.active,
          })),
        },
      },
    });
  }

  // ── CMS pages ──
  const pages = [
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
  for (const p of pages) {
    await db.contentPage.upsert({
      where: { slug: p.slug },
      update: { content: p.content, isPublished: p.isPublished },
      create: p,
    });
  }

  // ── FAQ ──
  const faqCount = await db.faqEntry.count();
  if (faqCount === 0) {
    await db.faqEntry.createMany({
      data: [
        { question: "How do I pay for my order?", answer: "We use manual bank transfer. After checkout you receive the account details and your order number; your order is prepared once payment is verified (usually within one business day).", position: 1 },
        { question: "When will my order ship?", answer: "Orders verified before 15:00 WIB on business days are dispatched the same day. You will receive a tracking number as soon as the label is created.", position: 2 },
        { question: "Is the tracking on this site live?", answer: "Tracking status here is updated manually by our team and can lag the courier by a few hours. The courier's own tracking link (provided with your tracking number) is always current.", position: 3 },
        { question: "Can I return a piece?", answer: "Yes — unworn pieces in original packaging can be returned within 7 days of delivery. Fragrances are final sale once sealed. See our Return & Refund Policy.", position: 4 },
        { question: "Do you ship internationally?", answer: "Currently we ship within Indonesia. International shipping is available on request — write to care@maisonelan.example for a quote.", position: 5 },
        { question: "How do I care for leather pieces?", answer: "Keep away from direct sunlight, stuff with paper when storing, and condition twice a year with a neutral leather balm. Full care notes ship with every order.", position: 6 },
      ],
    });
  }

  console.log("✅ Seed complete:");
  console.log(`   Owner:    ${owner.email} / Maison2025! (dev-only)`);
  console.log(`   Staff:    orders@maisonelan.dev / Staff2025! (dev-only)`);
  console.log(`   Customer: ${customer.email} / Customer2025! (dev-only)`);
  console.log(`   ${products.length} products, ${catData.length} categories, ${couriers.length} couriers, ${pages.length} CMS pages.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
