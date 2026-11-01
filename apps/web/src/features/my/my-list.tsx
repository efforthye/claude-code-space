"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/container";
import { Input } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import { forgetMine, readMine, rememberMine } from "./my-store";
import { lookupStatuses, type TrackedStatus } from "./track";

export function MyList() {
  const [rows, setRows] = useState<TrackedStatus[] | null>(null);
  const [code, setCode] = useState("");
  const [notFound, setNotFound] = useState(false);

  async function refresh() {
    const mine = readMine();
    setRows(mine.length ? await lookupStatuses(mine.map((m) => m.code)) : []);
  }
  useEffect(() => {
    // 마운트 시 한 번, 기기에 저장된 번호들의 현재 상태를 받아 온다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const [found] = await lookupStatuses([code]);
    if (!found) return setNotFound(true);
    rememberMine({ code: found.code, title: found.title, at: found.createdAt });
    setCode("");
    setNotFound(false);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={add} className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-paper p-4">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-sm font-semibold">
          번호로 찾기
          <Input value={code} onChange={(e) => { setCode(e.target.value); setNotFound(false); }} placeholder="MAYO-… / J-… / E-… / Q-…" />
        </label>
        <Button type="submit" variant="secondary">추가</Button>
        {notFound && <p className="w-full text-xs text-dot">그 번호로 찾은 신청이 없어요. 번호를 다시 확인해 주세요.</p>}
      </form>

      {rows === null ? (
        <p className="text-sm text-ink-soft">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="이 기기에서 넣은 신청이 아직 없어요">주문·입점 신청·전시 등록·문의를 하면 여기에서 진행 상황을 볼 수 있어요.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.code} className="flex flex-col gap-2 rounded-md border border-line bg-paper p-4 transition-shadow hover:shadow-md">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.tone}>{r.state}</Badge>
                <b className="flex-1">{r.title}</b>
                <span className="font-mono text-xs text-ink-soft">{r.code}</span>
              </div>
              <p className="text-xs text-ink-soft">{formatDateTime(r.createdAt)} 접수</p>
              {r.detail && <p className="rounded-sm bg-mist p-3 text-sm whitespace-pre-line">{r.kind === "inquiry" ? `MAYO 답변: ${r.detail}` : r.detail}</p>}
              <div className="flex gap-3 text-xs">
                {r.href && <Link href={r.href} className="link-sweep font-semibold">자세히 보기 →</Link>}
                <button type="button" onClick={() => { forgetMine(r.code); refresh(); }} className="text-ink-soft underline">이 기기에서 지우기</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
