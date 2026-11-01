import { describe, expect, it } from "vitest";
import { readPlace } from "./parse";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("readPlace", () => {
  it("combines the picked place with the detail", () => {
    const place = { name: "홍익대학교 홍문관", address: "서울 마포구 와우산로 94", lat: 37.55, lng: 126.92, url: "http://place.map.kakao.com/1" };
    const { place: p, venue } = readPlace(form({ venue: place.name, venuePlace: JSON.stringify(place), venueDetail: "4층" }), "venue");
    expect(venue).toBe("홍익대학교 홍문관 4층");
    expect(p?.url).toBe("https://place.map.kakao.com/1"); // forced to https
  });
  it("rejects tampered place JSON instead of storing it", () => {
    const bad = { name: "x", address: null, lat: 999, lng: 0, url: "javascript:alert(1)" };
    const { place } = readPlace(form({ venue: "x", venuePlace: JSON.stringify(bad) }), "venue");
    expect(place).toBeNull();
  });
  it("survives garbage", () => {
    expect(readPlace(form({ venuePlace: "{not json" }), "venue")).toEqual({ place: null, venue: "" });
  });
});
