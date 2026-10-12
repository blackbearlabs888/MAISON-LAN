"use client";

import { useParams } from "next/navigation";
import { PageEditor } from "@/components/webmaster/page-editor";

export default function EditCmsPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  if (!id) return null;
  return <PageEditor pageId={id} />;
}
