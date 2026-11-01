import type { ReactNode } from "react";
import { Container, PageHeading } from "@/components/ui/container";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Container className="flex max-w-3xl flex-col gap-6 py-10">
      <PageHeading title={title} />
      <p className="rounded-sm bg-warn-soft p-3 text-sm text-warn">
        초안입니다. 정식 오픈 전에 변호사 검토를 거쳐 확정본으로 바뀝니다.
      </p>
      <div className="flex flex-col gap-6 text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-bold [&_li]:ml-4 [&_li]:list-disc">
        {children}
      </div>
    </Container>
  );
}
