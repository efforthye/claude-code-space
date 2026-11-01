"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return <Button type="button" onClick={() => window.print()}>인쇄하기</Button>;
}
