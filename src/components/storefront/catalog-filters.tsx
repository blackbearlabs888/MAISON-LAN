"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface CategoryLite {
  id: string;
  name: string;
  slug: string;
}

interface Current {
  q: string;
  category: string;
  min: string;
  max: string;
  availability: string;
  sort: string;
}

const SORTS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Popularity" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
  { value: "name", label: "A – Z" },
];

export function CatalogFilters({
  categories,
  current,
}: {
  categories: CategoryLite[];
  current: Current;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [min, setMin] = useState(current.min);
  const [max, setMax] = useState(current.max);

  function applyParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page"); // reset pagination on filter change
    router.push(`/products${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function applyPrice(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (min) params.set("min", min);
    else params.delete("min");
    if (max) params.set("max", max);
    else params.delete("max");
    params.delete("page");
    router.push(`/products${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const availabilityOptions = [
    { value: "", label: "All" },
    { value: "in-stock", label: "In stock" },
    { value: "on-sale", label: "On sale" },
  ];

  return (
    <div className="space-y-8">
      {/* categories */}
      <div>
        <p className="editorial-label text-muted-foreground">Category</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          <li>
            <button
              onClick={() => applyParam("category", "")}
              className={cn(
                "lux-underline py-0.5 text-left font-light",
                !current.category ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All pieces
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => applyParam("category", c.slug)}
                data-active={current.category === c.slug}
                className={cn(
                  "lux-underline py-0.5 text-left font-light",
                  current.category === c.slug
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* price */}
      <div>
        <p className="editorial-label text-muted-foreground">Price</p>
        <form onSubmit={applyPrice} className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            className="h-9 border-border bg-background text-sm"
            aria-label="Minimum price"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            className="h-9 border-border bg-background text-sm"
            aria-label="Maximum price"
          />
          <Button type="submit" variant="outline" size="sm" className="h-9 shrink-0">
            Go
          </Button>
        </form>
      </div>

      {/* availability */}
      <div>
        <p className="editorial-label text-muted-foreground">Availability</p>
        <RadioGroup
          value={current.availability}
          onValueChange={(v) => applyParam("availability", v)}
          className="mt-3 space-y-1.5"
        >
          {availabilityOptions.map((o) => (
            <div key={o.value} className="flex items-center gap-2.5">
              <RadioGroupItem value={o.value} id={`av-${o.value || "all"}`} className="h-3.5 w-3.5" />
              <Label htmlFor={`av-${o.value || "all"}`} className="text-sm font-light cursor-pointer">
                {o.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* sort */}
      <div>
        <p className="editorial-label text-muted-foreground">Sort by</p>
        <RadioGroup
          value={current.sort}
          onValueChange={(v) => applyParam("sort", v)}
          className="mt-3 space-y-1.5"
        >
          {SORTS.map((o) => (
            <div key={o.value} className="flex items-center gap-2.5">
              <RadioGroupItem value={o.value} id={`sort-${o.value}`} className="h-3.5 w-3.5" />
              <Label htmlFor={`sort-${o.value}`} className="text-sm font-light cursor-pointer">
                {o.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  );
}
