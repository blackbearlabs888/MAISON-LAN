"use client";

// Shared CMS page form for /webmaster/pages/new and /[id]/edit.
// Content is markdown with a live preview (react-markdown).
// NOTE: the API exposes no GET /api/webmaster/pages/[id], so edit mode
// resolves the page from the list endpoint.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  apiGet,
  apiPost,
  apiPut,
  slugify,
  type ContentPage,
  type ContentPagePayload,
} from "@/lib/webmaster-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ErrorState,
  InlineSpinner,
  PageHeader,
  SectionLabel,
} from "@/components/webmaster/ui-bits";

export function PageEditor({ pageId }: { pageId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(pageId);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  // slug derives from the title until the user edits it manually
  const [slugOverride, setSlugOverride] = useState<string | null>(null);
  const slug = slugOverride ?? slugify(title);
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [showInFooter, setShowInFooter] = useState(true);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const load = useCallback(async () => {
    if (!pageId) return;
    try {
      const res = await apiGet<{ pages: ContentPage[] }>("/api/webmaster/pages");
      const page = res.pages.find((p) => p.id === pageId);
      if (!page) throw new Error("Page not found.");
      setTitle(page.title);
      setSlugOverride(page.slug);
      setContent(page.content);
      setIsPublished(page.isPublished);
      setShowInFooter(page.showInFooter);
      setSeoTitle(page.seoTitle ?? "");
      setSeoDescription(page.seoDescription ?? "");
      setLoading(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load page.");
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    void load();
  }, [load]);

  // (slug auto-suggestion is derived during render — see slugOverride)

  async function save() {
    if (title.trim().length < 2) return toast.error("Title is too short.");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return toast.error("Slug must be lowercase kebab-case.");
    if (!content.trim()) return toast.error("Content cannot be empty.");

    const payload: ContentPagePayload = {
      title: title.trim(),
      slug: slug.trim(),
      content,
      isPublished,
      showInFooter,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
    };
    setSaving(true);
    try {
      if (isEdit && pageId) {
        await apiPut(`/api/webmaster/pages/${pageId}`, payload);
        toast.success("Page updated.");
      } else {
        await apiPost("/api/webmaster/pages", payload);
        toast.success("Page created.");
      }
      router.push("/webmaster/pages");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={isEdit ? "Edit page" : "New page"} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <InlineSpinner /> Loading page…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title={isEdit ? "Edit page" : "New page"} />
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
        title={isEdit ? "Edit page" : "New page"}
        description={isEdit ? `/pages/${slug}` : "Markdown content rendered on the storefront."}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-none text-muted-foreground">
              <Link href="/webmaster/pages">
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
                  <Save className="h-4 w-4" aria-hidden /> Save page
                </>
              )}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Content (markdown)</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="write">
                <TabsList className="mb-3 rounded-none bg-secondary">
                  <TabsTrigger value="write" className="rounded-none">Write</TabsTrigger>
                  <TabsTrigger value="preview" className="rounded-none">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="write">
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="min-h-[460px] rounded-none font-mono text-sm"
                    placeholder={"## Our philosophy\n\nQuiet luxury, considered everyday…"}
                    maxLength={50000}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {content.length.toLocaleString()} / 50,000 characters · Markdown supported
                  </p>
                </TabsContent>
                <TabsContent value="preview">
                  <div className="scroll-slim min-h-[460px] max-h-[600px] overflow-y-auto border border-border bg-muted/30 p-6">
                    {content.trim() ? (
                      <div className="prose-sm max-w-none [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#9a7b4f] [&_blockquote]:pl-4 [&_blockquote]:italic [&_h1]:font-display [&_h1]:text-3xl [&_h2]:font-display [&_h2]:text-2xl [&_h3]:font-display [&_h3]:text-xl [&_li]:ml-4 [&_li]:list-disc [&_p]:my-3 [&_p]:leading-7">
                        <ReactMarkdown>{content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="pg-title" className="text-[13px] font-light">Title</Label>
                <Input
                  id="pg-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 h-10 rounded-none"
                  placeholder="About the house"
                  maxLength={140}
                />
              </div>
              <div>
                <Label htmlFor="pg-slug" className="text-[13px] font-light">Slug</Label>
                <Input
                  id="pg-slug"
                  value={slug}
                  onChange={(e) => setSlugOverride(e.target.value)}
                  className="mt-1.5 h-10 rounded-none font-mono text-[13px]"
                  placeholder="about"
                  maxLength={140}
                />
                <p className="mt-1 text-xs text-muted-foreground">URL: /pages/{slug || "…"}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pg-published" className="text-sm">Published</Label>
                <Switch id="pg-published" checked={isPublished} onCheckedChange={setIsPublished} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="pg-footer" className="text-sm">Show in footer</Label>
                <Switch id="pg-footer" checked={showInFooter} onCheckedChange={setShowInFooter} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="editorial-label text-muted-foreground">SEO (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="pg-seo-title" className="text-[13px] font-light">SEO title</Label>
                <Input
                  id="pg-seo-title"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  className="mt-1.5 h-10 rounded-none"
                  maxLength={200}
                />
              </div>
              <div>
                <Label htmlFor="pg-seo-desc" className="text-[13px] font-light">SEO description</Label>
                <Textarea
                  id="pg-seo-desc"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  className="mt-1.5 min-h-20 rounded-none"
                  maxLength={300}
                />
              </div>
            </CardContent>
          </Card>

          <div>
            <SectionLabel>Markdown is sanitized before rendering</SectionLabel>
          </div>
        </div>
      </div>
    </div>
  );
}
