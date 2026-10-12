"use client";

// Shared product form for /webmaster/products/new and /[id]/edit.
// Money inputs work in currency units (e.g. 1250000 for Rp 1.250.000) and are
// converted to integer cents on save. Images support upload or manual URL.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArrowLeft, ArrowDown, ArrowUp, Save, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
  centsToUnits,
  slugify,
  uploadImage,
  unitsToCents,
  type Category,
  type ProductDetail,
  type ProductPayload,
} from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  EmptyState,
  ErrorState,
  InlineSpinner,
  PageHeader,
  SectionLabel,
} from "@/components/webmaster/ui-bits";

interface ImageRow {
  url: string;
  alt: string;
}
interface VariantRow {
  id?: string;
  size: string;
  color: string;
  sku: string;
  stock: string;
  priceDelta: string; // currency units
}

const MAX_IMAGES = 8;

export function ProductEditor({ productId }: { productId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(productId);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // basics
  const [name, setName] = useState("");
  // slug derives from the name until the user edits it manually
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const slug = slugOverride ?? slugify(name);
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [material, setMaterial] = useState("");
  const [skuBase, setSkuBase] = useState("");

  // pricing (currency units)
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");

  // flags
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [isBestSeller, setIsBestSeller] = useState(false);

  // relations
  const [images, setImages] = useState<ImageRow[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([
    { size: "", color: "", sku: "", stock: "0", priceDelta: "0" },
  ]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [archived, setArchived] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    if (!productId) return;
    try {
      const res = await apiGet<{ product: ProductDetail }>(`/api/webmaster/products/${productId}`);
      const p = res.product;
      setName(p.name);
      setSlugOverride(p.slug);
      setDescription(p.description);
      setDetails(p.details ?? "");
      setMaterial(p.material ?? "");
      setSkuBase(p.skuBase);
      setPrice(centsToUnits(p.priceCents));
      setSalePrice(centsToUnits(p.salePriceCents));
      setIsActive(p.isActive);
      setIsFeatured(p.isFeatured);
      setIsNewArrival(p.isNewArrival);
      setIsBestSeller(p.isBestSeller);
      setImages(p.images.map((i) => ({ url: i.url, alt: i.alt ?? "" })));
      setVariants(
        p.variants.map((v) => ({
          id: v.id,
          size: v.size ?? "",
          color: v.color ?? "",
          sku: v.sku,
          stock: String(v.stock),
          priceDelta: centsToUnits(v.priceDeltaCents) || "0",
        }))
      );
      setSelectedCategories(p.categoryIds);
      setArchived(Boolean(p.archivedAt));
      setLoading(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load product.");
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // Async fetch — setState resolves after await, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    apiGet<{ categories: Category[] }>("/api/webmaster/categories")
      .then((res) => setCategories(res.categories))
      .catch(() => undefined);
  }, []);

  // (slug auto-suggestion is derived during render — see slugOverride)

  const totalStock = useMemo(
    () => variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
    [variants]
  );

  function updateVariant(idx: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addVariant() {
    setVariants((rows) => [
      ...rows,
      { size: "", color: "", sku: "", stock: "0", priceDelta: "0" },
    ]);
  }

  function generateSku(idx: number) {
    const base = skuBase.trim() || "ITEM";
    updateVariant(idx, { sku: `${base}-${idx + 1}` });
  }

  function moveImage(idx: number, dir: -1 | 1) {
    setImages((rows) => {
      const next = [...rows];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return rows;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function handleUpload(file: File | undefined, idx?: number) {
    if (!file) return;
    try {
      const url = await uploadImage(file);
      if (typeof idx === "number") {
        setImages((rows) => rows.map((r, i) => (i === idx ? { ...r, url } : r)));
      } else {
        setImages((rows) => (rows.length >= MAX_IMAGES ? rows : [...rows, { url, alt: "" }]));
      }
      toast.success("Image uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  function validate(): string | null {
    if (name.trim().length < 2) return "Product name is too short.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Slug must be lowercase kebab-case (e.g. silk-scarf).";
    if (description.trim().length < 10) return "Description must be at least 10 characters.";
    if (!skuBase.trim() || skuBase.trim().length < 2) return "SKU base must be at least 2 characters.";
    const priceCents = unitsToCents(price);
    if (priceCents === null || priceCents < 100) return "Enter a valid price (minimum 1.00 in major units).";
    if (salePrice.trim()) {
      const sale = unitsToCents(salePrice);
      if (sale === null) return "Sale price is not a valid number.";
      if (sale > priceCents) return "Sale price cannot exceed the regular price.";
    }
    if (variants.length === 0) return "Add at least one variant.";
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.sku.trim() || v.sku.trim().length < 2) return `Variant ${i + 1}: SKU must be at least 2 characters.`;
      if (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0)
        return `Variant ${i + 1}: stock must be a whole number ≥ 0.`;
      if (v.priceDelta.trim() && unitsToCents(v.priceDelta) === null)
        return `Variant ${i + 1}: price delta is not a valid number.`;
    }
    const skus = variants.map((v) => v.sku.trim().toLowerCase());
    if (new Set(skus).size !== skus.length) return "Variant SKUs must be unique.";
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    const payload: ProductPayload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim(),
      details: details.trim() || undefined,
      priceCents: unitsToCents(price) ?? 0,
      salePriceCents: salePrice.trim() ? unitsToCents(salePrice) : null,
      skuBase: skuBase.trim(),
      material: material.trim() || undefined,
      isFeatured,
      isNewArrival,
      isBestSeller,
      isActive,
      categoryIds: selectedCategories,
      images: images
        .filter((i) => i.url.trim())
        .map((i) => ({ url: i.url.trim(), alt: i.alt.trim() || undefined })),
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        size: v.size.trim() || undefined,
        color: v.color.trim() || undefined,
        sku: v.sku.trim(),
        stock: Math.max(0, Math.round(Number(v.stock) || 0)),
        priceDeltaCents: unitsToCents(v.priceDelta) ?? 0,
      })),
    };
    try {
      if (isEdit && productId) {
        await apiPut(`/api/webmaster/products/${productId}`, payload);
        toast.success("Product updated.");
      } else {
        await apiPost("/api/webmaster/products", payload);
        toast.success("Product created.");
      }
      router.push("/webmaster/products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
      setSaving(false);
    }
  }

  async function archive() {
    if (!productId) return;
    setArchiving(true);
    try {
      await apiDelete(`/api/webmaster/products/${productId}`);
      toast.success("Product archived.");
      router.push("/webmaster/products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed.");
      setArchiving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={isEdit ? "Edit product" : "New product"} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <InlineSpinner /> Loading product…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title={isEdit ? "Edit product" : "New product"} />
        <ErrorState
          message={loadError}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit product" : "New product"}
        description={
          isEdit
            ? `${name} · ${totalStock} units in stock${archived ? " · ARCHIVED" : ""}`
            : "Add a new piece to the catalog."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-none text-muted-foreground">
              <Link href="/webmaster/products">
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back
              </Link>
            </Button>
            <Button onClick={() => void save()} disabled={saving} className="rounded-none">
              {saving ? (
                <>
                  <InlineSpinner /> Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden /> Save product
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {/* Basics */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="p-name" className="text-[13px] font-light">Name</Label>
                <Input
                  id="p-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="Silk Twill Scarf"
                  maxLength={140}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-slug" className="text-[13px] font-light">
                    Slug <span className="text-muted-foreground">(auto from name)</span>
                  </Label>
                  <Input
                    id="p-slug"
                    value={slug}
                    onChange={(e) => setSlugOverride(e.target.value)}
                    className="mt-1.5 h-10 rounded-none font-mono text-[13px]"
                    placeholder="silk-twill-scarf"
                    maxLength={140}
                  />
                </div>
                <div>
                  <Label htmlFor="p-skubase" className="text-[13px] font-light">SKU base</Label>
                  <Input
                    id="p-skubase"
                    value={skuBase}
                    onChange={(e) => setSkuBase(e.target.value.toUpperCase())}
                    className="mt-1.5 h-10 rounded-none font-mono text-[13px]"
                    placeholder="ME-SCARF"
                    maxLength={40}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="p-desc" className="text-[13px] font-light">Description</Label>
                <Textarea
                  id="p-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1.5 min-h-28 rounded-none"
                  placeholder="The story of the piece — materials, cut, character…"
                  maxLength={5000}
                />
              </div>
              <div>
                <Label htmlFor="p-details" className="text-[13px] font-light">
                  Details <span className="text-muted-foreground">(care, dimensions — optional)</span>
                </Label>
                <Textarea
                  id="p-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="mt-1.5 min-h-20 rounded-none"
                  maxLength={5000}
                />
              </div>
              <div>
                <Label htmlFor="p-material" className="text-[13px] font-light">
                  Material <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="p-material"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="100% mulberry silk"
                  maxLength={160}
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="p-price" className="text-[13px] font-light">Price</Label>
                <Input
                  id="p-price"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="1250000"
                />
                <p className="mt-1 text-xs text-muted-foreground">In whole currency units — stored as cents automatically.</p>
              </div>
              <div>
                <Label htmlFor="p-sale" className="text-[13px] font-light">
                  Sale price <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="p-sale"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="numeric"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value)}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="995000"
                />
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="editorial-label text-muted-foreground">
                Images ({images.length}/{MAX_IMAGES})
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-none"
                disabled={images.length >= MAX_IMAGES}
                onClick={() => setImages((r) => [...r, { url: "", alt: "" }])}
              >
                Add image URL
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {images.length === 0 ? (
                <EmptyState title="No images yet" hint="Upload the first photo or paste an image URL." />
              ) : (
                <ul className="space-y-3">
                  {images.map((img, i) => (
                    <li key={i} className="flex items-start gap-3 border border-border p-3">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-border bg-muted">
                        {img.url ? (
                          <img src={img.url} alt={img.alt || `Image ${i + 1}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Empty</div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <Input
                          value={img.url}
                          onChange={(e) =>
                            setImages((rows) => rows.map((r, ri) => (ri === i ? { ...r, url: e.target.value } : r)))
                          }
                          className="h-9 rounded-none font-mono text-xs"
                          placeholder="/uploads/… or https://…"
                          maxLength={500}
                        />
                        <Input
                          value={img.alt}
                          onChange={(e) =>
                            setImages((rows) => rows.map((r, ri) => (ri === i ? { ...r, alt: e.target.value } : r)))
                          }
                          className="h-9 rounded-none text-sm"
                          placeholder="Alt text (accessibility)"
                          maxLength={200}
                        />
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:underline">
                            Upload file
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="sr-only"
                              onChange={(e) => {
                                void handleUpload(e.target.files?.[0], i);
                                e.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-none"
                          onClick={() => moveImage(i, -1)}
                          disabled={i === 0}
                          aria-label="Move image up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-none"
                          onClick={() => moveImage(i, 1)}
                          disabled={i === images.length - 1}
                          aria-label="Move image down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7 rounded-none text-destructive"
                          onClick={() => setImages((rows) => rows.filter((_, ri) => ri !== i))}
                          aria-label="Remove image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Variants */}
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="editorial-label text-muted-foreground">
                Variants — {totalStock} units total
              </CardTitle>
              <Button type="button" variant="outline" size="sm" className="rounded-none" onClick={addVariant}>
                Add variant
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {variants.map((v, i) => (
                <div key={i} className="grid items-end gap-2 border border-border p-3 sm:grid-cols-[1fr_1fr_1.4fr_0.7fr_1fr_auto]">
                  <div>
                    <Label className="text-xs font-light text-muted-foreground">Size</Label>
                    <Input
                      value={v.size}
                      onChange={(e) => updateVariant(i, { size: e.target.value })}
                      className="mt-1 h-9 rounded-none"
                      placeholder="One size"
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-light text-muted-foreground">Color</Label>
                    <Input
                      value={v.color}
                      onChange={(e) => updateVariant(i, { color: e.target.value })}
                      className="mt-1 h-9 rounded-none"
                      placeholder="Cognac"
                      maxLength={40}
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-light text-muted-foreground">SKU</Label>
                    <div className="mt-1 flex gap-1">
                      <Input
                        value={v.sku}
                        onChange={(e) => updateVariant(i, { sku: e.target.value })}
                        className="h-9 rounded-none font-mono text-xs"
                        placeholder="ME-SCARF-1"
                        maxLength={60}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-none"
                        onClick={() => generateSku(i)}
                        title={`Generate SKU ${skuBase || "ITEM"}-${i + 1}`}
                        aria-label="Generate SKU"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-light text-muted-foreground">Stock</Label>
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={v.stock}
                      onChange={(e) => updateVariant(i, { stock: e.target.value })}
                      className="mt-1 h-9 rounded-none"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-light text-muted-foreground">Price delta</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="numeric"
                      value={v.priceDelta}
                      onChange={(e) => updateVariant(i, { priceDelta: e.target.value })}
                      className="mt-1 h-9 rounded-none"
                      placeholder="0"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-none text-destructive"
                    onClick={() => setVariants((rows) => rows.filter((_, ri) => ri !== i))}
                    disabled={variants.length === 1}
                    aria-label="Remove variant"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Price delta adds to the base price for this variant (in whole currency units). Use the wand
                button to auto-generate SKUs from the SKU base.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT rail */}
        <div className="space-y-4">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Visibility flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="f-active" className="text-sm">Active on storefront</Label>
                <Switch id="f-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="f-featured" className="text-sm">Featured</Label>
                <Switch id="f-featured" checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="f-new" className="text-sm">New arrival</Label>
                <Switch id="f-new" checked={isNewArrival} onCheckedChange={setIsNewArrival} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="f-best" className="text-sm">Best seller</Label>
                <Switch id="f-best" checked={isBestSeller} onCheckedChange={setIsBestSeller} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories yet — create some under Categories.
                </p>
              ) : (
                <div className="scroll-slim max-h-96 space-y-2.5 overflow-y-auto pr-1">
                  {categories.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5">
                      <Checkbox
                        id={`cat-${c.id}`}
                        checked={selectedCategories.includes(c.id)}
                        onCheckedChange={(checked) =>
                          setSelectedCategories((cur) =>
                            checked ? [...cur, c.id] : cur.filter((id) => id !== c.id)
                          )
                        }
                      />
                      <Label htmlFor={`cat-${c.id}`} className="cursor-pointer text-sm font-light">
                        {c.name}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm text-muted-foreground">
              <p>{images.length} image{images.length === 1 ? "" : "s"}</p>
              <p>{variants.length} variant{variants.length === 1 ? "" : "s"} · {totalStock} units</p>
              <p>{selectedCategories.length} categor{selectedCategories.length === 1 ? "y" : "ies"}</p>
            </CardContent>
          </Card>

          {isEdit && productId && !archived ? (
            <Card className="rounded-none border-destructive/40 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="editorial-label text-destructive">Danger zone</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full rounded-none border-destructive/50 text-destructive hover:bg-destructive/5"
                  onClick={() => setArchiveOpen(true)}
                >
                  <Archive className="h-4 w-4" aria-hidden /> Archive this product
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Archive product?</AlertDialogTitle>
            <AlertDialogDescription>
              “{name}” will be hidden from the storefront. Order history is preserved; you can hard-delete
              it from the products list if it was never sold.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none"
              onClick={(e) => {
                e.preventDefault();
                void archive();
              }}
            >
              {archiving ? <InlineSpinner /> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-6 hidden xl:block">
        <SectionLabel>Changes are audited · Save to publish</SectionLabel>
      </div>
    </div>
  );
}
