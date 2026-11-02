"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "인쇄하기" }: { label?: string }) {
  return <Button type="button" onClick={() => window.print()}>{label}</Button>;
}
