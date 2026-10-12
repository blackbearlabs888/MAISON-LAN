"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

export interface HeroSlide {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const total = slides.length;

  useEffect(() => {
    if (total <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % total), 6000);
    return () => clearInterval(t);
  }, [total]);

  if (total === 0) return null;

  return (
    <section className="relative h-[72vh] min-h-[440px] w-full overflow-hidden bg-secondary" aria-label="Campaign">
      {slides.map((slide, i) => (
        <div
          key={slide.imageUrl + i}
          className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
          style={{ opacity: i === index ? 1 : 0, pointerEvents: i === index ? "auto" : "none" }}
          aria-hidden={i !== index}
        >
          <Image
            src={slide.imageUrl}
            alt={slide.title}
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/15 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="mx-auto w-full max-w-7xl px-6 sm:px-10">
              <div className="max-w-xl text-white">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/85">
                  {slide.title === "The Autumn Atelier" ? "Autumn — Winter 2025" : "New collection"}
                </p>
                <h1 className="mt-4 font-display text-4xl font-medium leading-[1.05] sm:text-6xl">
                  {slide.title}
                </h1>
                <p className="mt-4 max-w-md text-[15px] font-light leading-relaxed text-white/90">
                  {slide.subtitle}
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href={slide.ctaUrl}
                    className="inline-flex h-12 items-center bg-white px-8 text-[12px] font-medium uppercase tracking-[0.18em] text-neutral-900 transition-opacity hover:opacity-85"
                  >
                    {slide.ctaText}
                  </Link>
                  <Link
                    href="/collections/handbags"
                    className="inline-flex h-12 items-center border border-white/60 px-8 text-[12px] font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/10"
                  >
                    Handbags
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* dots */}
      {total > 1 && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className="h-[3px] w-8 transition-colors"
              style={{ background: i === index ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.45)" }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
