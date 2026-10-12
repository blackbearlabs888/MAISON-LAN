import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { db } from "@/lib/db";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const dynamic = "force-dynamic";

async function getPage(slug: string) {
  return db.contentPage.findUnique({ where: { slug } });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug).catch(() => null);
  if (!page) return { title: "Page" };
  return {
    title: page.seoTitle ?? page.title,
    description: page.seoDescription ?? undefined,
  };
}

export default async function ContentPageView({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || !page.isPublished) notFound();

  // FAQ page special-cases the structured FAQ entries.
  if (slug === "faq") {
    const faqs = await db.faqEntry.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
    });
    if (faqs.length > 0) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <p className="editorial-label text-muted-foreground">Help center</p>
            <h1 className="mt-3 font-display text-4xl">{page.title}</h1>
          </div>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((f) => (
              <AccordionItem key={f.id} value={f.id} className="border-border">
                <AccordionTrigger className="text-left font-display text-lg font-normal hover:no-underline">
                  {f.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm font-light leading-relaxed text-muted-foreground">
                  {f.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      );
    }
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="text-center">
        <p className="editorial-label text-muted-foreground">{page.showInFooter ? "Information" : "House"}</p>
        <h1 className="mt-3 font-display text-4xl">{page.title}</h1>
        <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Updated{" "}
          {new Date(page.updatedAt).toLocaleDateString("en-GB", { dateStyle: "long" })}
        </p>
      </div>
      <div className="prose-lux mt-10">
        {/* Markdown only — raw HTML is never rendered (XSS-safe by construction, D-07) */}
        <Markdown
          components={{
            h1: (p) => <h2 className="mt-8 font-display text-2xl" {...p} />,
            h2: (p) => <h3 className="mt-8 font-display text-xl" {...p} />,
            h3: (p) => <h4 className="mt-6 text-sm font-medium uppercase tracking-[0.14em]" {...p} />,
            p: (p) => <p className="mt-4 text-[15px] font-light leading-relaxed text-foreground/85" {...p} />,
            ul: (p) => <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] font-light text-foreground/85" {...p} />,
            ol: (p) => <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[15px] font-light text-foreground/85" {...p} />,
            a: (p) => <a className="underline underline-offset-4 hover:opacity-60" {...p} />,
            blockquote: (p) => <blockquote className="mt-6 border-l-2 border-[var(--brand-accent)] pl-4 italic text-muted-foreground" {...p} />,
          }}
        >
          {page.content}
        </Markdown>
      </div>
    </article>
  );
}
