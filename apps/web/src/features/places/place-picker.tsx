"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import type { Place } from "@/lib/domain/types";

type Result = Place & { category?: string };

declare global {
  interface Window {
    daum?: { Postcode: new (opts: { oncomplete: (d: { roadAddress: string; jibunAddress: string; buildingName: string }) => void }) => { open: () => void } };
  }
}

const POSTCODE_SRC = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

/**
 * 장소 선택 — 검색해서 고른다(직접 타이핑하지 않음). 카카오 로컬 검색이 기본이고,
 * 서버에 키가 없으면 우편번호 서비스(키 불필요)로 건물을 찾는다.
 * 폼에는 hidden 필드로 `${name}`(장소 이름)과 `${name}Place`(JSON)가 실린다.
 */
export function PlacePicker({
  name,
  defaultPlace,
  defaultDetail,
  error,
}: {
  name: string;
  defaultPlace?: Place | null;
  defaultDetail?: string;
  error?: string;
}) {
  const [place, setPlace] = useState<Place | null>(defaultPlace ?? null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "fallback">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (place || q.trim().length < 2 || status === "fallback") return;
    timer.current = setTimeout(async () => {
      setStatus("loading");
      const res = await fetch(`/api/places?q=${encodeURIComponent(q.trim())}`);
      if (res.status === 501) return setStatus("fallback");
      const data = (await res.json()) as { places: Result[] };
      setResults(data.places);
      setStatus(data.places.length ? "idle" : "empty");
    }, 250);
  }, [q, place, status]);

  function openPostcode() {
    if (!window.daum) return;
    new window.daum.Postcode({
      oncomplete: (d) => {
        const address = d.roadAddress || d.jibunAddress;
        setPlace({ name: d.buildingName || address, address, lat: null, lng: null, url: null });
      },
    }).open();
  }

  return (
    <div className="flex flex-col gap-2">
      <Script src={POSTCODE_SRC} strategy="lazyOnload" />
      <input type="hidden" name={name} value={place?.name ?? ""} />
      <input type="hidden" name={`${name}Place`} value={place ? JSON.stringify(place) : ""} />

      {place ? (
        <div className="flex items-start justify-between gap-3 rounded-sm border border-ink bg-mist p-3 text-sm">
          <div className="flex flex-col">
            <b>{place.name}</b>
            {place.address && place.address !== place.name && <span className="text-xs text-ink-soft">{place.address}</span>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setPlace(null); setQ(""); setResults([]); }}>
            변경
          </Button>
        </div>
      ) : status === "fallback" ? (
        <Button type="button" variant="secondary" onClick={openPostcode}>건물·주소 검색</Button>
      ) : (
        <div className="relative">
          <Input
            type="search"
            value={q}
            onChange={(e) => { setQ(e.target.value); setStatus("idle"); }}
            placeholder="장소 이름으로 검색 (예: 홍익대학교 홍문관)"
            aria-invalid={!!error}
            autoComplete="off"
          />
          {(results.length > 0 || status === "loading" || status === "empty") && q.trim().length >= 2 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-sm border border-line bg-paper shadow-lg">
              {status === "loading" && <li className="px-3 py-2 text-sm text-ink-soft">찾는 중…</li>}
              {status === "empty" && (
                <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-ink-soft">
                  검색 결과가 없어요
                  <button type="button" onClick={openPostcode} className="font-semibold text-ink underline">주소로 찾기</button>
                </li>
              )}
              {results.map((r, i) => (
                <li key={`${r.name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => setPlace({ name: r.name, address: r.address, lat: r.lat, lng: r.lng, url: r.url })}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-mist"
                  >
                    <b>{r.name}</b>
                    <span className="text-xs text-ink-soft">{r.address}{r.category && ` · ${r.category.split(" > ").pop()}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Input name={`${name}Detail`} defaultValue={defaultDetail} placeholder="상세 위치 (예: 4층 현대미술관)" />
    </div>
  );
}
