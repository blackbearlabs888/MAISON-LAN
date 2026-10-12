"use client";

import { useParams } from "next/navigation";
import { ProductEditor } from "@/components/webmaster/product-editor";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return null;
  return <ProductEditor productId={id} />;
}
