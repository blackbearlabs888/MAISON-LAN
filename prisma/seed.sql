-- ═════════════════════════════════════════════════════════════════════════
-- MAISON ÉLAN — PostgreSQL seed for the Neon SQL Editor
-- ═════════════════════════════════════════════════════════════════════════
-- Generated from prisma/seed.ts by scripts/generate-seed-sql.cjs (v0.2.2).
-- Regenerate after changing the seed:  bun run seed:sql
--
-- HOW TO USE — Neon Console → SQL Editor → paste this file → Run.
-- Every INSERT uses ON CONFLICT DO NOTHING → safe to run more than once.
--
-- ACCOUNTS (dev-only passwords — CHANGE THEM right after the first login):
--   owner@maisonelan.dev  / Maison2025!   (OWNER)
--   orders@maisonelan.dev / Staff2025!    (ORDER_MANAGER)
--   customer@example.com  / Customer2025! (CUSTOMER)
--
-- Login fails for EVERY password? The stored hash is not real bcrypt
-- (valid = exactly 60 chars, random ./A-Za-z0-9). Fix any account:
--   bun run hash:password "NewPassword123!"
--   UPDATE "User" SET "passwordHash" = '<hash>' WHERE email = '…';
--
-- OPTIONAL RESET — uncomment the block below to wipe demo/content data
-- before seeding (CASCADE also removes orders/sessions/wishlists that
-- belong to the seeded users). Keep commented on a production database!
-- BEGIN;
-- TRUNCATE "ProductImage", "ProductVariant", "ProductCategory", "Product",
--          "Category", "ShippingRate", "Courier", "Banner", "ContentPage",
--          "FaqEntry", "Address", "Session", "WishlistItem", "OrderItem",
--          "Order", "StoreSetting", "User" CASCADE;
-- COMMIT;

BEGIN;

-- ── User (3 rows)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "phone", "role", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mts0000rzivt3fewd0b', 'owner@maisonelan.dev', '$2b$10$nPAHCYKqomIwhvr14z0pxuP03Zid.Sd6SClNdUOvCU7FEh5jyzjeC', 'Amara Owner', '+62 811 200 100', 'OWNER', TRUE, '2026-10-14 02:43:28.337', '2026-10-14 02:43:28.337') ON CONFLICT DO NOTHING;
INSERT INTO "User" ("id", "email", "passwordHash", "name", "phone", "role", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mvs0001rziv4o8bzb0g', 'orders@maisonelan.dev', '$2b$10$JZ6K9p4vJpoSMTc2bHUi8eXegGSghyBakOeCeu1Vn.CStJsW5Azsm', 'Rara Order', NULL, 'ORDER_MANAGER', TRUE, '2026-10-14 02:43:28.408', '2026-10-14 02:43:28.408') ON CONFLICT DO NOTHING;
INSERT INTO "User" ("id", "email", "passwordHash", "name", "phone", "role", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mxs0002rziv7qyunztl', 'customer@example.com', '$2b$10$jkL/atN8SsF8Tvey4T4G3eJ.aayAFat6qYvBK5wiTpkLrMjpnfd4u', 'Ayu Kartika', '+62 812 345 678', 'CUSTOMER', TRUE, '2026-10-14 02:43:28.480', '2026-10-14 02:43:28.480') ON CONFLICT DO NOTHING;

-- ── Address (1 rows)
INSERT INTO "Address" ("id", "userId", "label", "fullName", "phone", "line1", "line2", "city", "province", "postalCode", "country", "isDefault", "createdAt", "updatedAt") VALUES ('seed-addr-1', 'cmv7i9mxs0002rziv7qyunztl', 'Home', 'Ayu Kartika', '+62 812 345 678', 'Jl. Cendana Raya No. 21', 'Blok C2', 'Jakarta Selatan', 'DKI Jakarta', '12430', 'Indonesia', TRUE, '2026-10-14 02:43:28.482', '2026-10-14 02:43:28.482') ON CONFLICT DO NOTHING;

-- ── StoreSetting (1 rows)
INSERT INTO "StoreSetting" ("id", "data", "updatedAt") VALUES ('global', '{"storeName":"MAISON ÉLAN","tagline":"Quiet luxury, considered everyday.","logoText":"MAISON ÉLAN","logoUrl":null,"primaryColor":"#9A7B4F","announcementText":"Complimentary shipping on orders above Rp 1.000.000 — worldwide.","announcementEnabled":true,"currency":"IDR","locale":"id-ID","timezone":"Asia/Jakarta","orderNumberPrefix":"ME","contactEmail":"care@maisonelan.example","contactPhone":"+62 21 500 8900","contactAddress":"Jl. Kemang Raya No. 12, Jakarta Selatan 12730, Indonesia","social":{"instagram":"https://instagram.com/maisonelan.example","tiktok":"https://tiktok.com/@maisonelan.example"},"seoTitle":"MAISON ÉLAN — Quiet luxury, considered everyday","seoDescription":"Premium handbags, jewelry, apparel and fragrance crafted from honest materials. Editorial design, enduring quality.","ogImageUrl":"/images/hero-1.jpg","maintenanceEnabled":false,"maintenanceMessage":"We are refining the boutique. Please return shortly.","registrationEnabled":true,"enforceStock":true,"lowStockThreshold":5,"paymentInstructions":"Transfer the exact total to:\n\nBank: BCATARA\nAccount: 8450 1299 007\nName: PT Maison Élan Nusantara\n\nInclude your order number as the transfer reference. Orders ship after payment is verified (usually within 1 business day).","cancellationNote":"Orders may be cancelled while status is PENDING_PAYMENT. Contact care within 2 hours of payment verification for changes.","freeShippingAboveCents":100000000,"newsletterEnabled":true,"homepage":{"heroHeadline":"The Autumn Atelier","heroSubline":"Considered pieces in leather, silk and gold — made slowly, worn always.","showCategories":true,"showNewArrivals":true,"showBestSellers":true,"showEditorial":true},"navItems":[{"label":"New Arrivals","href":"/products?sort=newest"},{"label":"Handbags","href":"/collections/handbags"},{"label":"Jewelry","href":"/collections/jewelry"},{"label":"Apparel","href":"/collections/apparel"},{"label":"Accessories","href":"/collections/accessories"},{"label":"Fragrance","href":"/collections/fragrance"}],"footerAbout":"MAISON ÉLAN is an independent house crafting leather goods, jewelry and apparel from honest materials. Designed in Jakarta, made responsibly.","footer":{"careTitle":"Customer Care","shopTitle":"The House","contactTitle":"Contact","hours":"Mon–Fri, 9:00–18:00 WIB","bottomNote":"Manual bank transfer · Secured checkout","newsletterTitle":"Join the house list","newsletterSubtitle":"Early access to new collections, private previews and editorial stories. No noise.","customerCare":[{"label":"Track Order","href":"/track"},{"label":"FAQ","href":"/pages/faq"}],"shop":[{"label":"Handbags","href":"/collections/handbags"},{"label":"Jewelry","href":"/collections/jewelry"},{"label":"Apparel","href":"/collections/apparel"},{"label":"All Collections","href":"/products"}]},"socialLinks":[{"platform":"Instagram","url":"https://instagram.com/maisonelan.example"},{"platform":"TikTok","url":"https://tiktok.com/@maisonelan.example"}]}', '2026-10-14 02:43:28.258') ON CONFLICT DO NOTHING;

-- ── Category (5 rows)
INSERT INTO "Category" ("id", "name", "slug", "description", "imageUrl", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mxv0003rzivrfkk1h4g', 'Handbags', 'handbags', 'Structured silhouettes in full-grain leather.', '/images/cat-handbags.jpg', 1, TRUE, '2026-10-14 02:43:28.483', '2026-10-14 02:43:28.483') ON CONFLICT DO NOTHING;
INSERT INTO "Category" ("id", "name", "slug", "description", "imageUrl", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mxw0004rzivbkv1pp9r', 'Jewelry', 'jewelry', 'Recycled gold and freshwater pearls.', '/images/cat-jewelry.jpg', 2, TRUE, '2026-10-14 02:43:28.484', '2026-10-14 02:43:28.484') ON CONFLICT DO NOTHING;
INSERT INTO "Category" ("id", "name", "slug", "description", "imageUrl", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mxx0005rzivr3x399zv', 'Apparel', 'apparel', 'Cashmere, silk and wool — cut to last.', '/images/cat-apparel.jpg', 3, TRUE, '2026-10-14 02:43:28.485', '2026-10-14 02:43:28.485') ON CONFLICT DO NOTHING;
INSERT INTO "Category" ("id", "name", "slug", "description", "imageUrl", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mxy0006rzivjk93gw3q', 'Accessories', 'accessories', 'The finishing gesture.', '/images/cat-accessories.jpg', 4, TRUE, '2026-10-14 02:43:28.486', '2026-10-14 02:43:28.486') ON CONFLICT DO NOTHING;
INSERT INTO "Category" ("id", "name", "slug", "description", "imageUrl", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mxz0007rzivcsnfdk1v', 'Fragrance', 'fragrance', 'Quiet scents, long memories.', '/images/cat-fragrance.jpg', 5, TRUE, '2026-10-14 02:43:28.487', '2026-10-14 02:43:28.487') ON CONFLICT DO NOTHING;

-- ── Product (14 rows)
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9my10008rzivmisrhhp3', 'Élan Structured Tote', 'elan-structured-tote', 'A sculpted everyday tote in vegetable-tanned cognac leather with brushed gold hardware. Opens wide, stands on its own, softens beautifully with wear.', 'Full-grain vegetable-tanned leather
Suede-lined interior with zip pocket
H 30 × W 38 × D 14 cm
Made in Bandung, Indonesia', 429000000, NULL, 'ME-TOTE-CGN', 'Vegetable-tanned calf leather', TRUE, TRUE, TRUE, TRUE, NULL, '2026-10-14 02:43:28.490', '2026-10-14 02:43:28.490') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9my4000drzivsipsx8y5', 'Aurèle Shoulder Bag', 'aurele-shoulder-bag', 'A curved, minimalist shoulder bag in smooth black leather with a single elegant strap. The quiet hero of an evening wardrobe.', 'Smooth calf leather
Magnetic flap closure
H 18 × W 26 × D 8 cm
Dust bag included', 359000000, 299000000, 'ME-AUR-NR', 'Smooth calf leather', TRUE, FALSE, TRUE, TRUE, NULL, '2026-10-14 02:43:28.492', '2026-10-14 02:43:28.492') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9my7000grzivxsrgk147', 'Lune Mini Crossbody', 'mini-crossbody-lune', 'A petite crossbody on a delicate gold chain. Fits the phone, the card holder and nothing that doesn''t spark joy.', 'Pebbled calf leather
Gold-tone chain strap, 120 cm drop
H 14 × W 20 × D 6 cm', 249000000, NULL, 'ME-LUNE-TAN', 'Pebbled calf leather', FALSE, TRUE, FALSE, TRUE, NULL, '2026-10-14 02:43:28.495', '2026-10-14 02:43:28.495') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9my9000jrzivnui54w97', 'Collier Pendant Necklace', 'collier-pendentif-or', 'A whisper-fine 18k gold chain holding a single hand-polished pendant. Layer it or let it speak alone.', '18k recycled gold
45 cm chain with 2 cm extender
Hallmarked at clasp', 329000000, NULL, 'ME-COL-OR', '18k recycled gold', TRUE, FALSE, TRUE, TRUE, NULL, '2026-10-14 02:43:28.498', '2026-10-14 02:43:28.498') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9myb000orzivz4ocnpq0', 'Perle Drop Earrings', 'perle-drop-earrings', 'Freshwater pearls suspended from hand-drawn gold hooks — weightless, luminous, inevitable.', 'Freshwater pearls, 8 mm
18k gold-filled hooks
Pair, presented in a lacquered box', 159000000, NULL, 'ME-PER-DRP', 'Freshwater pearl, 18k gold-filled', FALSE, TRUE, FALSE, TRUE, NULL, '2026-10-14 02:43:28.500', '2026-10-14 02:43:28.500') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9mye000rrzivg2h1ju24', 'Manchette Cuff', 'manchette-cuff', 'A sculptural brushed-gold cuff with a satin finish. Slips on, stays all day.', 'Brushed 18k gold plating over brass
Open cuff, one size
Nickel-free', 189000000, NULL, 'ME-MAN-CUF', '18k gold-plated brass', TRUE, FALSE, FALSE, TRUE, NULL, '2026-10-14 02:43:28.502', '2026-10-14 02:43:28.502') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9myh000urziv3jmrcfm3', 'Classique Watch', 'montre-classique', 'A minimalist quartz watch with a cream dial, sapphire glass and cognac leather strap. Time, told quietly.', 'Swiss quartz movement
36 mm case, sapphire crystal
Italian leather strap, quick-release', 489000000, NULL, 'ME-MON-CLQ', 'Stainless steel, Italian leather', FALSE, FALSE, TRUE, TRUE, NULL, '2026-10-14 02:43:28.505', '2026-10-14 02:43:28.505') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9myj000yrzivmhgiv10v', 'Solène Sunglasses', 'lunettes-tortoise', 'Hand-polished tortoise acetate with warm gradient lenses. Five-barrel hinges, zero fuss.', 'Italian acetate
CAT-3 UV400 gradient lenses
Comes with leather case', 145000000, NULL, 'ME-SOL-TRT', 'Italian acetate', FALSE, TRUE, FALSE, TRUE, NULL, '2026-10-14 02:43:28.507', '2026-10-14 02:43:28.507') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9myn0012rziv4lpl6i1e', 'Foulard Silk Scarf', 'foulard-soie', 'A 90 cm silk twill scarf with hand-rolled edges, printed in our atelier archive pattern.', '100% mulberry silk twill
90 × 90 cm, hand-rolled hem
Dry clean only', 119000000, 89000000, 'ME-FOU-IVR', 'Mulberry silk', FALSE, FALSE, FALSE, TRUE, NULL, '2026-10-14 02:43:28.511', '2026-10-14 02:43:28.511') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9myp0016rzivtg6k0uxv', 'Bifold Wallet', 'portefeuille-bifold', 'A slim cognac bifold with suede interior — six cards, folded notes, nothing more.', 'Vegetable-tanned leather, suede lining
10 × 9.5 cm closed
Six card slots', 99000000, NULL, 'ME-POR-CGN', 'Vegetable-tanned leather', FALSE, FALSE, FALSE, TRUE, NULL, '2026-10-14 02:43:28.514', '2026-10-14 02:43:28.514') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9mys0019rzivp1ofsuda', 'Manteau Camel Coat', 'manteau-camel', 'A double-breasted camel coat in Italian wool-cashmere. Tailored shoulder, relaxed fall — the season''s defining layer.', '70% wool, 30% cashmere
Fully lined, horn buttons
Dry clean
Model wears size M', 799000000, NULL, 'ME-MAN-CML', 'Wool-cashmere', TRUE, TRUE, TRUE, TRUE, NULL, '2026-10-14 02:43:28.516', '2026-10-14 02:43:28.516') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9myv001frzivfo45z1qx', 'Pull Cashmere Crew', 'pull-cachemire', 'A 12-gauge cashmere crew in warm oatmeal. Fine, dense, endlessly wearable.', '100% Inner Mongolian cashmere
12-gauge knit
Hand wash cold or dry clean', 319000000, NULL, 'ME-PUL-OAT', 'Cashmere', FALSE, FALSE, TRUE, TRUE, NULL, '2026-10-14 02:43:28.520', '2026-10-14 02:43:28.520') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9myy001krzivdlhfcgh8', 'Robe Silk Slip', 'robe-soie-champagne', 'A bias-cut champagne silk slip with delicate straps. Falls like water, photographs like light.', '19-momme mulberry silk
Bias cut, adjustable straps
Dry clean', 389000000, NULL, 'ME-ROB-CHP', 'Mulberry silk', TRUE, TRUE, FALSE, TRUE, NULL, '2026-10-14 02:43:28.523', '2026-10-14 02:43:28.523') ON CONFLICT DO NOTHING;
INSERT INTO "Product" ("id", "name", "slug", "description", "details", "priceCents", "salePriceCents", "skuBase", "material", "isFeatured", "isNewArrival", "isBestSeller", "isActive", "archivedAt", "createdAt", "updatedAt") VALUES ('cmv7i9mz1001przivhmsaak3b', 'Eau de Parfum N°1', 'eau-de-parfum-no1', 'Our signature scent: bergamot and fig leaf over sandalwood and white musk. 50 ml, bottled in frosted glass with a turned-wood cap.', 'Eau de parfum, 22% concentration
Top: bergamot, fig leaf
Heart: iris, jasmine
Base: sandalwood, white musk
50 ml', 179000000, NULL, 'ME-PAR-50', 'Eau de parfum', FALSE, FALSE, TRUE, TRUE, NULL, '2026-10-14 02:43:28.525', '2026-10-14 02:43:28.525') ON CONFLICT DO NOTHING;

-- ── ProductImage (19 rows)
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9my10009rziv12wk32mz', 'cmv7i9my10008rzivmisrhhp3', '/images/products/tote-cognac.jpg', 'Élan Structured Tote — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9my1000arzivnnumbgqz', 'cmv7i9my10008rzivmisrhhp3', '/images/cat-handbags.jpg', 'Élan Structured Tote — view 2', 1) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9my4000erzivhbjw96wb', 'cmv7i9my4000drzivsipsx8y5', '/images/products/shoulder-bag-black.jpg', 'Aurèle Shoulder Bag — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9my7000hrziviy03kn1e', 'cmv7i9my7000grzivxsrgk147', '/images/products/mini-crossbody.jpg', 'Lune Mini Crossbody — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9mya000krziv76lg60qb', 'cmv7i9my9000jrzivnui54w97', '/images/products/gold-necklace.jpg', 'Collier Pendant Necklace — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9mya000lrziva03ugziq', 'cmv7i9my9000jrzivnui54w97', '/images/cat-jewelry.jpg', 'Collier Pendant Necklace — view 2', 1) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9myc000przivy2v2ywug', 'cmv7i9myb000orzivz4ocnpq0', '/images/products/pearl-earrings.jpg', 'Perle Drop Earrings — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9mye000srziv5fk9kkrw', 'cmv7i9mye000rrzivg2h1ju24', '/images/products/gold-cuff.jpg', 'Manchette Cuff — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9myh000vrzivdwwo708m', 'cmv7i9myh000urziv3jmrcfm3', '/images/products/watch-classic.jpg', 'Classique Watch — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9myj000zrzivw17vl1av', 'cmv7i9myj000yrzivmhgiv10v', '/images/products/sunglasses.jpg', 'Solène Sunglasses — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9myj0010rziviqucpv04', 'cmv7i9myj000yrzivmhgiv10v', '/images/cat-accessories.jpg', 'Solène Sunglasses — view 2', 1) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9myn0013rzivd8xvon1n', 'cmv7i9myn0012rziv4lpl6i1e', '/images/products/silk-scarf.jpg', 'Foulard Silk Scarf — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9myp0017rzivog96zkld', 'cmv7i9myp0016rzivtg6k0uxv', '/images/products/leather-wallet.jpg', 'Bifold Wallet — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9mys001arzivhr2fcdjq', 'cmv7i9mys0019rzivp1ofsuda', '/images/products/wool-coat.jpg', 'Manteau Camel Coat — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9mys001brzivc3v177sp', 'cmv7i9mys0019rzivp1ofsuda', '/images/cat-apparel.jpg', 'Manteau Camel Coat — view 2', 1) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9myv001grzivs9xpzrrp', 'cmv7i9myv001frzivfo45z1qx', '/images/products/cashmere-knit.jpg', 'Pull Cashmere Crew — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9myy001lrzivjefqla9c', 'cmv7i9myy001krzivdlhfcgh8', '/images/products/slip-dress.jpg', 'Robe Silk Slip — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9mz1001qrziv3y9xei0o', 'cmv7i9mz1001przivhmsaak3b', '/images/products/fragrance.jpg', 'Eau de Parfum N°1 — view 1', 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductImage" ("id", "productId", "url", "alt", "position") VALUES ('cmv7i9mz1001rrziv0a202i9v', 'cmv7i9mz1001przivhmsaak3b', '/images/cat-fragrance.jpg', 'Eau de Parfum N°1 — view 2', 1) ON CONFLICT DO NOTHING;

-- ── ProductVariant (25 rows)
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9my1000brziviokb2e9v', 'cmv7i9my10008rzivmisrhhp3', NULL, 'Cognac', 'ME-TOTE-CGN', 12, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9my1000crzivq775psrk', 'cmv7i9my10008rzivmisrhhp3', NULL, 'Noir', 'ME-TOTE-NR', 8, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9my4000frzivj8isxzoy', 'cmv7i9my4000drzivsipsx8y5', NULL, 'Noir', 'ME-AUR-NR', 6, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9my7000irziv7ivuilno', 'cmv7i9my7000grzivxsrgk147', NULL, 'Camel', 'ME-LUNE-TAN', 10, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9mya000mrzivc3u74nb7', 'cmv7i9my9000jrzivnui54w97', NULL, 'Gold', 'ME-COL-OR45', 15, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9mya000nrziv3xqut9pn', 'cmv7i9my9000jrzivnui54w97', '50 cm', 'Gold', 'ME-COL-OR50', 9, 20000000) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myc000qrzivx52qg1tg', 'cmv7i9myb000orzivz4ocnpq0', NULL, 'Ivory', 'ME-PER-DRP', 18, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9mye000trzivkhoima7u', 'cmv7i9mye000rrzivg2h1ju24', NULL, 'Gold', 'ME-MAN-CUF', 3, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myh000wrziv3urfxsrg', 'cmv7i9myh000urziv3jmrcfm3', NULL, 'Cognac', 'ME-MON-CLQ-CG', 7, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myh000xrziv6r23kl34', 'cmv7i9myh000urziv3jmrcfm3', NULL, 'Noir', 'ME-MON-CLQ-NR', 5, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myj0011rzivtr18wf4q', 'cmv7i9myj000yrzivmhgiv10v', NULL, 'Tortoise', 'ME-SOL-TRT', 14, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myn0014rzivzie1bzx9', 'cmv7i9myn0012rziv4lpl6i1e', NULL, 'Ivory', 'ME-FOU-IVR', 20, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myn0015rzivkrkftpex', 'cmv7i9myn0012rziv4lpl6i1e', NULL, 'Caramel', 'ME-FOU-CAR', 11, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myp0018rzivkcb8d8ej', 'cmv7i9myp0016rzivtg6k0uxv', NULL, 'Cognac', 'ME-POR-CGN', 25, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9mys001crzivx5po7u8u', 'cmv7i9mys0019rzivp1ofsuda', 'S', 'Camel', 'ME-MAN-CML-S', 4, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9mys001drzivhic9cpo0', 'cmv7i9mys0019rzivp1ofsuda', 'M', 'Camel', 'ME-MAN-CML-M', 6, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9mys001erzivhldcwwz8', 'cmv7i9mys0019rzivp1ofsuda', 'L', 'Camel', 'ME-MAN-CML-L', 3, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myv001hrzivxrolobi6', 'cmv7i9myv001frzivfo45z1qx', 'S', 'Oatmeal', 'ME-PUL-OAT-S', 8, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myv001irziv4jpx3exj', 'cmv7i9myv001frzivfo45z1qx', 'M', 'Oatmeal', 'ME-PUL-OAT-M', 10, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myv001jrziv8vctt55q', 'cmv7i9myv001frzivfo45z1qx', 'L', 'Oatmeal', 'ME-PUL-OAT-L', 7, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myy001mrzivlfuwhuwh', 'cmv7i9myy001krzivdlhfcgh8', 'XS', 'Champagne', 'ME-ROB-CHP-XS', 3, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myy001nrziv4om7sjnj', 'cmv7i9myy001krzivdlhfcgh8', 'S', 'Champagne', 'ME-ROB-CHP-S', 5, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9myy001orzivegsvjbsv', 'cmv7i9myy001krzivdlhfcgh8', 'M', 'Champagne', 'ME-ROB-CHP-M', 4, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9mz1001srzivgvgus5h0', 'cmv7i9mz1001przivhmsaak3b', '50 ml', NULL, 'ME-PAR-50', 16, 0) ON CONFLICT DO NOTHING;
INSERT INTO "ProductVariant" ("id", "productId", "size", "color", "sku", "stock", "priceDeltaCents") VALUES ('cmv7i9mz1001trzivqgkutgf2', 'cmv7i9mz1001przivhmsaak3b', '100 ml', NULL, 'ME-PAR-100', 9, 90000000) ON CONFLICT DO NOTHING;

-- ── ProductCategory (14 rows)
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9my10008rzivmisrhhp3', 'cmv7i9mxv0003rzivrfkk1h4g') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9my4000drzivsipsx8y5', 'cmv7i9mxv0003rzivrfkk1h4g') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9my7000grzivxsrgk147', 'cmv7i9mxv0003rzivrfkk1h4g') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9my9000jrzivnui54w97', 'cmv7i9mxw0004rzivbkv1pp9r') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9myb000orzivz4ocnpq0', 'cmv7i9mxw0004rzivbkv1pp9r') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9mye000rrzivg2h1ju24', 'cmv7i9mxw0004rzivbkv1pp9r') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9myh000urziv3jmrcfm3', 'cmv7i9mxy0006rzivjk93gw3q') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9myj000yrzivmhgiv10v', 'cmv7i9mxy0006rzivjk93gw3q') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9myn0012rziv4lpl6i1e', 'cmv7i9mxy0006rzivjk93gw3q') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9myp0016rzivtg6k0uxv', 'cmv7i9mxy0006rzivjk93gw3q') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9mys0019rzivp1ofsuda', 'cmv7i9mxx0005rzivr3x399zv') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9myv001frzivfo45z1qx', 'cmv7i9mxx0005rzivr3x399zv') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9myy001krzivdlhfcgh8', 'cmv7i9mxx0005rzivr3x399zv') ON CONFLICT DO NOTHING;
INSERT INTO "ProductCategory" ("productId", "categoryId") VALUES ('cmv7i9mz1001przivhmsaak3b', 'cmv7i9mxz0007rzivcsnfdk1v') ON CONFLICT DO NOTHING;

-- ── Courier (3 rows)
INSERT INTO "Courier" ("id", "name", "code", "description", "trackingUrlTemplate", "minDays", "maxDays", "isActive", "position", "createdAt", "updatedAt") VALUES ('cmv7i9mz6001wrziv8kjajz3y', 'Nusantara Express', 'NEX', 'Next-day delivery across Java, 2–4 days outer islands.', 'https://tracking.nusantara-express.example/?no={trackingNumber}', 1, 3, TRUE, 1, '2026-10-14 02:43:28.530', '2026-10-14 02:43:28.530') ON CONFLICT DO NOTHING;
INSERT INTO "Courier" ("id", "name", "code", "description", "trackingUrlTemplate", "minDays", "maxDays", "isActive", "position", "createdAt", "updatedAt") VALUES ('cmv7i9mz8001zrzivrvovd14k', 'SwiftLog', 'SWFT', 'Reliable nationwide coverage with weekly pickup.', 'https://swiftlog.example/track/{trackingNumber}', 2, 5, TRUE, 2, '2026-10-14 02:43:28.532', '2026-10-14 02:43:28.532') ON CONFLICT DO NOTHING;
INSERT INTO "Courier" ("id", "name", "code", "description", "trackingUrlTemplate", "minDays", "maxDays", "isActive", "position", "createdAt", "updatedAt") VALUES ('cmv7i9mz90021rziv8hc13al0', 'KurirKita Same Day', 'KITA', 'Same-day courier for Jabodetabek.', NULL, 0, 1, TRUE, 3, '2026-10-14 02:43:28.534', '2026-10-14 02:43:28.534') ON CONFLICT DO NOTHING;

-- ── ShippingRate (4 rows)
INSERT INTO "ShippingRate" ("id", "courierId", "name", "type", "region", "rateCents", "freeAboveCents", "isActive") VALUES ('cmv7i9mz6001xrzivekndfn62', 'cmv7i9mz6001wrziv8kjajz3y', 'Reguler', 'FLAT', '*', 2000000, NULL, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "ShippingRate" ("id", "courierId", "name", "type", "region", "rateCents", "freeAboveCents", "isActive") VALUES ('cmv7i9mz6001yrzivnqid0i0z', 'cmv7i9mz6001wrziv8kjajz3y', 'Express Jakarta', 'REGION', 'DKI Jakarta', 3500000, NULL, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "ShippingRate" ("id", "courierId", "name", "type", "region", "rateCents", "freeAboveCents", "isActive") VALUES ('cmv7i9mz80020rzivfc5qgk49', 'cmv7i9mz8001zrzivrvovd14k', 'Reguler', 'FLAT', '*', 1800000, NULL, TRUE) ON CONFLICT DO NOTHING;
INSERT INTO "ShippingRate" ("id", "courierId", "name", "type", "region", "rateCents", "freeAboveCents", "isActive") VALUES ('cmv7i9mz90022rzivfjakub4z', 'cmv7i9mz90021rziv8hc13al0', 'Same Day Jabodetabek', 'REGION', 'DKI Jakarta', 4000000, NULL, TRUE) ON CONFLICT DO NOTHING;

-- ── Banner (2 rows)
INSERT INTO "Banner" ("id", "title", "subtitle", "imageUrl", "mobileImageUrl", "ctaText", "ctaUrl", "position", "isActive", "startsAt", "endsAt", "createdAt", "updatedAt") VALUES ('cmv7i9mz4001urziv9xnottm5', 'The Autumn Atelier', 'Considered pieces in leather, silk and gold — made slowly, worn always.', '/images/hero-1.jpg', NULL, 'Shop the collection', '/products', 1, TRUE, NULL, NULL, '2026-10-14 02:43:28.528', '2026-10-14 02:43:28.528') ON CONFLICT DO NOTHING;
INSERT INTO "Banner" ("id", "title", "subtitle", "imageUrl", "mobileImageUrl", "ctaText", "ctaUrl", "position", "isActive", "startsAt", "endsAt", "createdAt", "updatedAt") VALUES ('cmv7i9mz4001vrziv58q8vfqs', 'Objects of intent', 'Hand-finished leather goods, released in small series.', '/images/hero-2.jpg', NULL, 'Explore handbags', '/collections/handbags', 2, TRUE, NULL, NULL, '2026-10-14 02:43:28.528', '2026-10-14 02:43:28.528') ON CONFLICT DO NOTHING;

-- ── ContentPage (7 rows)
INSERT INTO "ContentPage" ("id", "title", "slug", "content", "isPublished", "showInFooter", "seoTitle", "seoDescription", "createdAt", "updatedAt") VALUES ('cmv7i9mzb0023rzivgy3g2eb1', 'Frequently Asked Questions', 'faq', 'Answers to the questions our care team hears most. If yours isn''t here, write to care@maisonelan.example.', TRUE, TRUE, NULL, NULL, '2026-10-14 02:43:28.535', '2026-10-14 02:43:28.535') ON CONFLICT DO NOTHING;
INSERT INTO "ContentPage" ("id", "title", "slug", "content", "isPublished", "showInFooter", "seoTitle", "seoDescription", "createdAt", "updatedAt") VALUES ('cmv7i9mzc0024rzivz8jigvhf', 'About Us', 'about-us', '## A house built on restraint

MAISON ÉLAN began in a two-room atelier in Jakarta with a single belief: fewer, better things. We design leather goods, jewelry and apparel that are meant to be kept — repaired, re-worn, passed on.

### Our materials
- Vegetable-tanned leathers from tanneries audited for water treatment
- 18k recycled gold, hallmarked in-house
- Mulberry silk and Inner Mongolian cashmere from certified partners

### Our pace
We release small series, not seasons. When a piece sells through, it returns only when the atelier can make it right.

*Quiet luxury, considered everyday.*', TRUE, TRUE, NULL, NULL, '2026-10-14 02:43:28.536', '2026-10-14 02:43:28.536') ON CONFLICT DO NOTHING;
INSERT INTO "ContentPage" ("id", "title", "slug", "content", "isPublished", "showInFooter", "seoTitle", "seoDescription", "createdAt", "updatedAt") VALUES ('cmv7i9mzd0025rzivn12ehldf', 'Terms & Conditions', 'terms-and-conditions', 'By placing an order with MAISON ÉLAN you agree to the terms below.

### Orders
All orders are subject to acceptance and availability. Prices are shown in IDR and include applicable taxes. We reserve the right to cancel orders in case of pricing errors, with full refund.

### Payment
Payment is completed by manual bank transfer using the instructions provided at checkout. Orders are prepared after payment verification, usually within one business day.

### Liability
Our liability for any claim relating to an order shall not exceed the purchase value of that order.', TRUE, TRUE, NULL, NULL, '2026-10-14 02:43:28.537', '2026-10-14 02:43:28.537') ON CONFLICT DO NOTHING;
INSERT INTO "ContentPage" ("id", "title", "slug", "content", "isPublished", "showInFooter", "seoTitle", "seoDescription", "createdAt", "updatedAt") VALUES ('cmv7i9mze0026rzivholbct54', 'Privacy Policy', 'privacy-policy', 'We collect only what we need to serve you: your name, contact details, addresses and order history.

### What we never do
- We never sell your personal data.
- We never store card numbers (we don''t take cards online).
- We never share your details with third parties beyond the courier delivering your order.

### Your rights
You may request a copy or deletion of your personal data at any time by writing to care@maisonelan.example.', TRUE, TRUE, NULL, NULL, '2026-10-14 02:43:28.539', '2026-10-14 02:43:28.539') ON CONFLICT DO NOTHING;
INSERT INTO "ContentPage" ("id", "title", "slug", "content", "isPublished", "showInFooter", "seoTitle", "seoDescription", "createdAt", "updatedAt") VALUES ('cmv7i9mzf0027rzivm3802ox9', 'Shipping Policy', 'shipping-policy', '### Dispatch
Orders are dispatched from our Jakarta atelier after payment verification, typically within one business day. You will receive a tracking number by email and can follow progress on our Track Order page.

### Carriers & rates
We work with insured domestic couriers. Rates are calculated at checkout based on your province and order value. Orders above the free-shipping threshold ship free.

### Manual tracking
Tracking status on this site is updated manually by our operations team and may lag live courier data by a few hours. The courier''s own tracking page always shows the most current scan.', TRUE, TRUE, NULL, NULL, '2026-10-14 02:43:28.539', '2026-10-14 02:43:28.539') ON CONFLICT DO NOTHING;
INSERT INTO "ContentPage" ("id", "title", "slug", "content", "isPublished", "showInFooter", "seoTitle", "seoDescription", "createdAt", "updatedAt") VALUES ('cmv7i9mzh0028rzivq4ktuits', 'Return & Refund Policy', 'return-and-refund-policy', '### 7-day returns
Unworn, unwashed pieces in original packaging may be returned within 7 days of delivery. Personalized and fragrance items are final sale once sealed.

### How to return
1. Write to care@maisonelan.example with your order number.
2. We arrange pickup or provide a drop-off point.
3. Refunds are issued to your bank account within 5 business days of receiving the return.

### Faulty items
In the rare case of a fault, we repair, replace or refund — your choice — including return shipping.', TRUE, TRUE, NULL, NULL, '2026-10-14 02:43:28.541', '2026-10-14 02:43:28.541') ON CONFLICT DO NOTHING;
INSERT INTO "ContentPage" ("id", "title", "slug", "content", "isPublished", "showInFooter", "seoTitle", "seoDescription", "createdAt", "updatedAt") VALUES ('cmv7i9mzi0029rzivhahcklwn', 'Size Guide', 'size-guide', '### Apparel (cm)
| Size | Bust | Waist | Hip |
| --- | --- | --- | --- |
| XS | 80 | 62 | 88 |
| S | 84 | 66 | 92 |
| M | 88 | 70 | 96 |
| L | 94 | 76 | 102 |

### Bags
Dimensions are listed on every product page (height × width × depth).

### Jewelry
Necklaces come in 45 cm (choker-adjacent) and 50 cm (classic) lengths. Cuffs are one size, open style.', TRUE, FALSE, NULL, NULL, '2026-10-14 02:43:28.542', '2026-10-14 02:43:28.542') ON CONFLICT DO NOTHING;

-- ── FaqEntry (6 rows)
INSERT INTO "FaqEntry" ("id", "question", "answer", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mzk002arzivsy09o46h', 'How do I pay for my order?', 'We use manual bank transfer. After checkout you receive the account details and your order number; your order is prepared once payment is verified (usually within one business day).', 1, TRUE, '2026-10-14 02:43:28.544', '2026-10-14 02:43:28.544') ON CONFLICT DO NOTHING;
INSERT INTO "FaqEntry" ("id", "question", "answer", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mzk002brzivas0ehoqv', 'When will my order ship?', 'Orders verified before 15:00 WIB on business days are dispatched the same day. You will receive a tracking number as soon as the label is created.', 2, TRUE, '2026-10-14 02:43:28.544', '2026-10-14 02:43:28.544') ON CONFLICT DO NOTHING;
INSERT INTO "FaqEntry" ("id", "question", "answer", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mzk002crzivbidlnlbv', 'Is the tracking on this site live?', 'Tracking status here is updated manually by our team and can lag the courier by a few hours. The courier''s own tracking link (provided with your tracking number) is always current.', 3, TRUE, '2026-10-14 02:43:28.544', '2026-10-14 02:43:28.544') ON CONFLICT DO NOTHING;
INSERT INTO "FaqEntry" ("id", "question", "answer", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mzk002drzivanomc09r', 'Can I return a piece?', 'Yes — unworn pieces in original packaging can be returned within 7 days of delivery. Fragrances are final sale once sealed. See our Return & Refund Policy.', 4, TRUE, '2026-10-14 02:43:28.544', '2026-10-14 02:43:28.544') ON CONFLICT DO NOTHING;
INSERT INTO "FaqEntry" ("id", "question", "answer", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mzk002erzivdtzcbl5l', 'Do you ship internationally?', 'Currently we ship within Indonesia. International shipping is available on request — write to care@maisonelan.example for a quote.', 5, TRUE, '2026-10-14 02:43:28.544', '2026-10-14 02:43:28.544') ON CONFLICT DO NOTHING;
INSERT INTO "FaqEntry" ("id", "question", "answer", "position", "isActive", "createdAt", "updatedAt") VALUES ('cmv7i9mzk002frzivblbzdgr1', 'How do I care for leather pieces?', 'Keep away from direct sunlight, stuff with paper when storing, and condition twice a year with a neutral leather balm. Full care notes ship with every order.', 6, TRUE, '2026-10-14 02:43:28.544', '2026-10-14 02:43:28.544') ON CONFLICT DO NOTHING;

COMMIT;

-- Done. Sign in as owner@maisonelan.dev / Maison2025!, then change the password.
