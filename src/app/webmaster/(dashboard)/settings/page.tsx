"use client";

// Store settings — white-label brand, commerce, payment, contact, navigation
// and SEO configuration. Money fields edit in currency units; cents on wire.

import { useCallback, useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPut, unitsToCents, centsToUnits } from "@/lib/webmaster-client";
// type-only import — erased at build time, keeps db code out of the client bundle
import type { NavItem, StoreSettings } from "@/lib/store-settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, InlineSpinner, PageHeader, SectionLabel } from "@/components/webmaster/ui-bits";

type Phase = "loading" | "ready" | "error";

export default function SettingsPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [freeAbove, setFreeAbove] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const res = await apiGet<{ settings: StoreSettings }>("/api/webmaster/settings");
      setSettings(res.settings);
      setFreeAbove(centsToUnits(res.settings.freeShippingAboveCents));
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(update: Partial<StoreSettings>) {
    setSettings((s) => (s ? { ...s, ...update } : s));
  }

  async function save() {
    if (!settings) return;
    if (settings.storeName.trim().length === 0) return toast.error("Store name cannot be empty.");
    if (settings.logoText.trim().length === 0) return toast.error("Logo text cannot be empty.");
    if (!/^#[0-9a-fA-F]{6}$/.test(settings.primaryColor))
      return toast.error("Primary color must be a hex value like #9A7B4F.");
    if (!/^[A-Z0-9]{1,8}$/.test(settings.orderNumberPrefix))
      return toast.error("Order number prefix must be 1–8 uppercase letters/numbers.");
    if (settings.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contactEmail.trim()))
      return toast.error("Contact email is not a valid address.");
    let freeAboveCents: number | null = null;
    if (freeAbove.trim()) {
      freeAboveCents = unitsToCents(freeAbove);
      if (freeAboveCents === null) return toast.error("Free-shipping threshold is not a valid number.");
    }
    if (settings.navItems.some((n) => !n.label.trim() || !n.href.trim()))
      return toast.error("Every navigation item needs a label and a link.");
    if (settings.socialLinks.some((s) => !s.platform.trim() || !s.url.trim()))
      return toast.error("Every social account needs a platform name and a URL.");
    if (settings.socialLinks.some((s) => !/^https?:\/\/\S+$/i.test(s.url.trim())))
      return toast.error("Social links must be absolute http(s) URLs (https://…).");
    if (
      settings.footer.customerCare.some((n) => !n.label.trim() || !n.href.trim()) ||
      settings.footer.shop.some((n) => !n.label.trim() || !n.href.trim())
    )
      return toast.error("Every footer link needs a label and a link.");

    setSaving(true);
    try {
      await apiPut("/api/webmaster/settings", {
        storeName: settings.storeName,
        tagline: settings.tagline,
        logoText: settings.logoText,
        primaryColor: settings.primaryColor,
        announcementText: settings.announcementText,
        announcementEnabled: settings.announcementEnabled,
        currency: settings.currency,
        locale: settings.locale,
        timezone: settings.timezone,
        orderNumberPrefix: settings.orderNumberPrefix,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        contactAddress: settings.contactAddress,
        socialLinks: settings.socialLinks,
        footer: settings.footer,
        seoTitle: settings.seoTitle,
        seoDescription: settings.seoDescription,
        maintenanceEnabled: settings.maintenanceEnabled,
        maintenanceMessage: settings.maintenanceMessage,
        registrationEnabled: settings.registrationEnabled,
        enforceStock: settings.enforceStock,
        lowStockThreshold: settings.lowStockThreshold,
        paymentInstructions: settings.paymentInstructions,
        cancellationNote: settings.cancellationNote,
        freeShippingAboveCents: freeAboveCents,
        newsletterEnabled: settings.newsletterEnabled,
        homepage: settings.homepage,
        navItems: settings.navItems,
        footerAbout: settings.footerAbout,
      });
      toast.success("Settings saved — the storefront updates immediately.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (phase === "loading") {
    return (
      <div>
        <PageHeader title="Store settings" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <InlineSpinner /> Loading settings…
        </div>
      </div>
    );
  }

  if (phase === "error" || !settings) {
    return (
      <div>
        <PageHeader title="Store settings" />
        <ErrorState message={error ?? "Failed to load settings."} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Store settings"
        description="White-label configuration — no redeploy needed."
        actions={
          <Button onClick={() => void save()} disabled={saving} className="rounded-none">
            {saving ? (
              <>
                <InlineSpinner /> Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden /> Save settings
              </>
            )}
          </Button>
        }
      />

      <Tabs defaultValue="brand">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-0 rounded-none bg-secondary">
          <TabsTrigger value="brand" className="rounded-none">Brand</TabsTrigger>
          <TabsTrigger value="homepage" className="rounded-none">Homepage</TabsTrigger>
          <TabsTrigger value="commerce" className="rounded-none">Commerce</TabsTrigger>
          <TabsTrigger value="payment" className="rounded-none">Payment</TabsTrigger>
          <TabsTrigger value="contact" className="rounded-none">Contact</TabsTrigger>
          <TabsTrigger value="navigation" className="rounded-none">Navigation</TabsTrigger>
          <TabsTrigger value="footer" className="rounded-none">Footer &amp; Social</TabsTrigger>
          <TabsTrigger value="seo" className="rounded-none">SEO</TabsTrigger>
        </TabsList>

        {/* Brand */}
        <TabsContent value="brand">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Brand identity</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-storename" className="text-[13px] font-light">Store name</Label>
                <Input
                  id="s-storename"
                  value={settings.storeName}
                  onChange={(e) => patch({ storeName: e.target.value })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="s-logotext" className="text-[13px] font-light">Logo text (wordmark)</Label>
                <Input
                  id="s-logotext"
                  value={settings.logoText}
                  onChange={(e) => patch({ logoText: e.target.value })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={80}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="s-tagline" className="text-[13px] font-light">Tagline</Label>
                <Input
                  id="s-tagline"
                  value={settings.tagline}
                  onChange={(e) => patch({ tagline: e.target.value })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={160}
                />
              </div>
              <div>
                <Label htmlFor="s-color" className="text-[13px] font-light">Primary accent color</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    id="s-color"
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => patch({ primaryColor: e.target.value })}
                    className="h-10 w-14 cursor-pointer border border-input bg-card p-1"
                    aria-label="Primary color"
                  />
                  <Input
                    value={settings.primaryColor}
                    onChange={(e) => patch({ primaryColor: e.target.value })}
                    className="h-10 flex-1 rounded-none font-mono text-sm"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="flex items-end pb-2.5">
                <div className="flex items-center gap-2">
                  <Switch
                    id="s-ann-enabled"
                    checked={settings.announcementEnabled}
                    onCheckedChange={(v) => patch({ announcementEnabled: v })}
                  />
                  <Label htmlFor="s-ann-enabled" className="text-sm">Show announcement bar</Label>
                </div>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="s-ann" className="text-[13px] font-light">Announcement text</Label>
                <Input
                  id="s-ann"
                  value={settings.announcementText}
                  onChange={(e) => patch({ announcementText: e.target.value })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={240}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Homepage */}
        <TabsContent value="homepage">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Homepage hero &amp; sections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="s-hero-h" className="text-[13px] font-light">Hero headline</Label>
                <Input
                  id="s-hero-h"
                  value={settings.homepage.heroHeadline}
                  onChange={(e) => patch({ homepage: { ...settings.homepage, heroHeadline: e.target.value } })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="s-hero-s" className="text-[13px] font-light">Hero subline</Label>
                <Textarea
                  id="s-hero-s"
                  value={settings.homepage.heroSubline}
                  onChange={(e) => patch({ homepage: { ...settings.homepage, heroSubline: e.target.value } })}
                  className="mt-1.5 min-h-20 rounded-none"
                  maxLength={240}
                />
              </div>
              <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                {(
                  [
                    ["showCategories", "Show category grid"],
                    ["showNewArrivals", "Show new arrivals"],
                    ["showBestSellers", "Show best sellers"],
                    ["showEditorial", "Show editorial banner"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-3 border border-border p-3">
                    <Label htmlFor={`s-${key}`} className="text-sm">{label}</Label>
                    <Switch
                      id={`s-${key}`}
                      checked={settings.homepage[key]}
                      onCheckedChange={(v) => patch({ homepage: { ...settings.homepage, [key]: v } })}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commerce */}
        <TabsContent value="commerce">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Commerce &amp; operations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-currency" className="text-[13px] font-light">Currency (ISO 4217)</Label>
                <Input
                  id="s-currency"
                  value={settings.currency}
                  onChange={(e) => patch({ currency: e.target.value.toUpperCase() })}
                  className="mt-1.5 h-10 rounded-none font-mono text-sm"
                  maxLength={6}
                />
              </div>
              <div>
                <Label htmlFor="s-locale" className="text-[13px] font-light">Locale</Label>
                <Input
                  id="s-locale"
                  value={settings.locale}
                  onChange={(e) => patch({ locale: e.target.value })}
                  className="mt-1.5 h-10 rounded-none font-mono text-sm"
                  maxLength={10}
                />
              </div>
              <div>
                <Label htmlFor="s-tz" className="text-[13px] font-light">Timezone</Label>
                <Input
                  id="s-tz"
                  value={settings.timezone}
                  onChange={(e) => patch({ timezone: e.target.value })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={60}
                />
              </div>
              <div>
                <Label htmlFor="s-prefix" className="text-[13px] font-light">Order number prefix</Label>
                <Input
                  id="s-prefix"
                  value={settings.orderNumberPrefix}
                  onChange={(e) => patch({ orderNumberPrefix: e.target.value.toUpperCase() })}
                  className="mt-1.5 h-10 rounded-none font-mono text-sm"
                  maxLength={8}
                />
              </div>
              <div>
                <Label htmlFor="s-free" className="text-[13px] font-light">
                  Free shipping above <span className="text-muted-foreground">(whole units, empty = off)</span>
                </Label>
                <Input
                  id="s-free"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="numeric"
                  value={freeAbove}
                  onChange={(e) => setFreeAbove(e.target.value)}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="1000000"
                />
              </div>
              <div>
                <Label htmlFor="s-lowstock" className="text-[13px] font-light">Low-stock threshold</Label>
                <Input
                  id="s-lowstock"
                  type="number"
                  min={0}
                  max={1000}
                  value={settings.lowStockThreshold}
                  onChange={(e) => patch({ lowStockThreshold: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                  className="mt-1.5 h-10 rounded-none"
                />
              </div>
              <div className="space-y-3 border-t border-border pt-4 sm:col-span-2">
                {(
                  [
                    ["enforceStock", "Enforce stock — block checkout beyond available units", settings.enforceStock, (v: boolean) => patch({ enforceStock: v })],
                    ["registrationEnabled", "Allow customer registration", settings.registrationEnabled, (v: boolean) => patch({ registrationEnabled: v })],
                    ["maintenanceEnabled", "Maintenance mode — storefront shows a notice", settings.maintenanceEnabled, (v: boolean) => patch({ maintenanceEnabled: v })],
                  ] as const
                ).map(([key, label, value, setter]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`s-${key}`} className="text-sm font-light">{label}</Label>
                    <Switch id={`s-${key}`} checked={value} onCheckedChange={setter} />
                  </div>
                ))}
                <div>
                  <Label htmlFor="s-maint-msg" className="text-[13px] font-light">Maintenance message</Label>
                  <Textarea
                    id="s-maint-msg"
                    value={settings.maintenanceMessage}
                    onChange={(e) => patch({ maintenanceMessage: e.target.value })}
                    className="mt-1.5 min-h-16 rounded-none"
                    maxLength={300}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Manual payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="s-pay" className="text-[13px] font-light">Payment instructions (shown at checkout)</Label>
                <Textarea
                  id="s-pay"
                  value={settings.paymentInstructions}
                  onChange={(e) => patch({ paymentInstructions: e.target.value })}
                  className="mt-1.5 min-h-40 rounded-none font-mono text-sm"
                  maxLength={2000}
                />
              </div>
              <div>
                <Label htmlFor="s-cancel" className="text-[13px] font-light">Cancellation note</Label>
                <Textarea
                  id="s-cancel"
                  value={settings.cancellationNote}
                  onChange={(e) => patch({ cancellationNote: e.target.value })}
                  className="mt-1.5 min-h-24 rounded-none"
                  maxLength={600}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact */}
        <TabsContent value="contact">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Contact &amp; social</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="s-email" className="text-[13px] font-light">Contact email</Label>
                <Input
                  id="s-email"
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => patch({ contactEmail: e.target.value })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={160}
                />
              </div>
              <div>
                <Label htmlFor="s-phone" className="text-[13px] font-light">Contact phone</Label>
                <Input
                  id="s-phone"
                  value={settings.contactPhone}
                  onChange={(e) => patch({ contactPhone: e.target.value })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={40}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="s-addr" className="text-[13px] font-light">Address</Label>
                <Textarea
                  id="s-addr"
                  value={settings.contactAddress}
                  onChange={(e) => patch({ contactAddress: e.target.value })}
                  className="mt-1.5 min-h-20 rounded-none"
                  maxLength={300}
                />
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Social media accounts are managed in the <span className="font-medium">Footer &amp; Social</span> tab.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Navigation */}
        <TabsContent value="navigation">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="editorial-label text-muted-foreground">
                Storefront navigation ({settings.navItems.length}/12)
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="rounded-none"
                disabled={settings.navItems.length >= 12}
                onClick={() => patch({ navItems: [...settings.navItems, { label: "", href: "" }] })}
              >
                <Plus className="h-4 w-4" aria-hidden /> Add item
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {settings.navItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 border border-border p-2.5">
                  <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                  <Input
                    value={item.label}
                    onChange={(e) =>
                      patch({
                        navItems: settings.navItems.map((n, ni) =>
                          ni === i ? { ...n, label: e.target.value } : n
                        ),
                      })
                    }
                    className="h-9 flex-1 rounded-none"
                    placeholder="Label"
                    maxLength={40}
                    aria-label={`Navigation item ${i + 1} label`}
                  />
                  <Input
                    value={item.href}
                    onChange={(e) =>
                      patch({
                        navItems: settings.navItems.map((n, ni) =>
                          ni === i ? { ...n, href: e.target.value } : n
                        ),
                      })
                    }
                    className="h-9 flex-[1.4] rounded-none font-mono text-xs"
                    placeholder="/collections/handbags"
                    maxLength={200}
                    aria-label={`Navigation item ${i + 1} link`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-none text-destructive"
                    onClick={() => patch({ navItems: settings.navItems.filter((_, ni) => ni !== i) })}
                    aria-label={`Remove navigation item ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <SectionLabel>Shown in the storefront header in this order</SectionLabel>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Footer & Social */}
        <TabsContent value="footer">
          <div className="space-y-4">
            {/* Social media accounts */}
            <Card className="rounded-none border-border shadow-none">
              <CardHeader className="flex-row items-center justify-between pb-3">
                <CardTitle className="editorial-label text-muted-foreground">
                  Social media accounts ({settings.socialLinks.length}/12)
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  disabled={settings.socialLinks.length >= 12}
                  onClick={() =>
                    patch({ socialLinks: [...settings.socialLinks, { platform: "", url: "https://" }] })
                  }
                >
                  <Plus className="h-4 w-4" aria-hidden /> Add account
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {settings.socialLinks.map((s, i) => (
                  <div key={i} className="flex flex-col gap-2 border border-border p-2.5 sm:flex-row sm:items-center">
                    <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <Input
                      value={s.platform}
                      onChange={(e) =>
                        patch({
                          socialLinks: settings.socialLinks.map((x, xi) =>
                            xi === i ? { ...x, platform: e.target.value } : x
                          ),
                        })
                      }
                      className="h-9 w-full rounded-none sm:w-40"
                      placeholder="Platform (e.g. Instagram)"
                      maxLength={40}
                      list="social-platform-suggestions"
                      aria-label={`Social account ${i + 1} platform`}
                    />
                    <Input
                      value={s.url}
                      onChange={(e) =>
                        patch({
                          socialLinks: settings.socialLinks.map((x, xi) =>
                            xi === i ? { ...x, url: e.target.value } : x
                          ),
                        })
                      }
                      className="h-9 flex-1 rounded-none font-mono text-xs"
                      placeholder="https://instagram.com/yourstore"
                      maxLength={300}
                      aria-label={`Social account ${i + 1} URL`}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 rounded-none text-destructive"
                      onClick={() => patch({ socialLinks: settings.socialLinks.filter((_, xi) => xi !== i) })}
                      aria-label={`Remove social account ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <datalist id="social-platform-suggestions">
                  {["Instagram", "TikTok", "Facebook", "X (Twitter)", "YouTube", "WhatsApp", "Shopee", "Tokopedia", "Pinterest", "LinkedIn"].map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <SectionLabel>
                  Rendered in the footer brand column, in this order — absolute https(s) URLs only
                </SectionLabel>
              </CardContent>
            </Card>

            {/* Footer texts & newsletter */}
            <Card className="rounded-none border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="editorial-label text-muted-foreground">Footer content</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="s-f-about" className="text-[13px] font-light">About text (brand column)</Label>
                  <Textarea
                    id="s-f-about"
                    value={settings.footerAbout}
                    onChange={(e) => patch({ footerAbout: e.target.value })}
                    className="mt-1.5 min-h-24 rounded-none"
                    maxLength={600}
                  />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch
                    id="s-f-news"
                    checked={settings.newsletterEnabled}
                    onCheckedChange={(v) => patch({ newsletterEnabled: v })}
                  />
                  <Label htmlFor="s-f-news" className="text-sm">Show newsletter signup</Label>
                </div>
                <div>
                  <Label htmlFor="s-f-news-title" className="text-[13px] font-light">Newsletter title</Label>
                  <Input
                    id="s-f-news-title"
                    value={settings.footer.newsletterTitle}
                    onChange={(e) => patch({ footer: { ...settings.footer, newsletterTitle: e.target.value } })}
                    className="mt-1.5 h-10 rounded-none"
                    maxLength={80}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="s-f-news-sub" className="text-[13px] font-light">Newsletter subtitle</Label>
                  <Textarea
                    id="s-f-news-sub"
                    value={settings.footer.newsletterSubtitle}
                    onChange={(e) => patch({ footer: { ...settings.footer, newsletterSubtitle: e.target.value } })}
                    className="mt-1.5 min-h-16 rounded-none"
                    maxLength={240}
                  />
                </div>
                <div>
                  <Label htmlFor="s-f-hours" className="text-[13px] font-light">Business hours (contact column)</Label>
                  <Input
                    id="s-f-hours"
                    value={settings.footer.hours}
                    onChange={(e) => patch({ footer: { ...settings.footer, hours: e.target.value } })}
                    className="mt-1.5 h-10 rounded-none"
                    maxLength={120}
                  />
                </div>
                <div>
                  <Label htmlFor="s-f-bottom" className="text-[13px] font-light">Bottom bar note</Label>
                  <Input
                    id="s-f-bottom"
                    value={settings.footer.bottomNote}
                    onChange={(e) => patch({ footer: { ...settings.footer, bottomNote: e.target.value } })}
                    className="mt-1.5 h-10 rounded-none"
                    maxLength={160}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Footer link columns */}
            <Card className="rounded-none border-border shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="editorial-label text-muted-foreground">Footer link columns</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <div>
                  <Label htmlFor="s-f-care-title" className="text-[13px] font-light">First column title</Label>
                  <Input
                    id="s-f-care-title"
                    value={settings.footer.careTitle}
                    onChange={(e) => patch({ footer: { ...settings.footer, careTitle: e.target.value } })}
                    className="mt-1.5 mb-3 h-10 rounded-none"
                    maxLength={40}
                  />
                  <LinkListEditor
                    ariaLabel="Customer care footer link"
                    items={settings.footer.customerCare}
                    onChange={(customerCare) => patch({ footer: { ...settings.footer, customerCare } })}
                    hrefPlaceholder="/track"
                    hint="CMS pages marked “show in footer” are appended below these links automatically."
                  />
                </div>
                <div>
                  <Label htmlFor="s-f-shop-title" className="text-[13px] font-light">Second column title</Label>
                  <Input
                    id="s-f-shop-title"
                    value={settings.footer.shopTitle}
                    onChange={(e) => patch({ footer: { ...settings.footer, shopTitle: e.target.value } })}
                    className="mt-1.5 mb-3 h-10 rounded-none"
                    maxLength={40}
                  />
                  <LinkListEditor
                    ariaLabel="Shop footer link"
                    items={settings.footer.shop}
                    onChange={(shop) => patch({ footer: { ...settings.footer, shop } })}
                    hrefPlaceholder="/collections/handbags"
                  />
                </div>
                <div>
                  <Label htmlFor="s-f-contact-title" className="text-[13px] font-light">Contact column title</Label>
                  <Input
                    id="s-f-contact-title"
                    value={settings.footer.contactTitle}
                    onChange={(e) => patch({ footer: { ...settings.footer, contactTitle: e.target.value } })}
                    className="mt-1.5 h-10 rounded-none"
                    maxLength={40}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SEO */}
        <TabsContent value="seo">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Search engine defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="s-seo-title" className="text-[13px] font-light">SEO title</Label>
                <Input
                  id="s-seo-title"
                  value={settings.seoTitle}
                  onChange={(e) => patch({ seoTitle: e.target.value })}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={160}
                />
              </div>
              <div>
                <Label htmlFor="s-seo-desc" className="text-[13px] font-light">SEO description</Label>
                <Textarea
                  id="s-seo-desc"
                  value={settings.seoDescription}
                  onChange={(e) => patch({ seoDescription: e.target.value })}
                  className="mt-1.5 min-h-24 rounded-none"
                  maxLength={320}
                />
              </div>
              <div>
                <Label htmlFor="s-og" className="text-[13px] font-light">
                  OG image URL <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="s-og"
                  value={settings.ogImageUrl ?? ""}
                  onChange={(e) => patch({ ogImageUrl: e.target.value || null })}
                  className="mt-1.5 h-10 rounded-none font-mono text-xs"
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Reusable editor for the footer link columns (customer care / shop). */
function LinkListEditor({
  items,
  onChange,
  ariaLabel,
  hrefPlaceholder,
  hint,
}: {
  items: NavItem[];
  onChange: (items: NavItem[]) => void;
  ariaLabel: string;
  hrefPlaceholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 border border-border p-2.5">
          <span className="w-5 text-center text-xs text-muted-foreground">{i + 1}</span>
          <Input
            value={item.label}
            onChange={(e) => onChange(items.map((n, ni) => (ni === i ? { ...n, label: e.target.value } : n)))}
            className="h-9 flex-1 rounded-none"
            placeholder="Label"
            maxLength={40}
            aria-label={`${ariaLabel} ${i + 1} label`}
          />
          <Input
            value={item.href}
            onChange={(e) => onChange(items.map((n, ni) => (ni === i ? { ...n, href: e.target.value } : n)))}
            className="h-9 flex-[1.3] rounded-none font-mono text-xs"
            placeholder={hrefPlaceholder ?? "/track"}
            maxLength={200}
            aria-label={`${ariaLabel} ${i + 1} link`}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-none text-destructive"
            onClick={() => onChange(items.filter((_, ni) => ni !== i))}
            aria-label={`Remove ${ariaLabel.toLowerCase()} ${i + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="rounded-none"
        disabled={items.length >= 12}
        onClick={() => onChange([...items, { label: "", href: "" }])}
      >
        <Plus className="h-4 w-4" aria-hidden /> Add link
      </Button>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
