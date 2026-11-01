import { describe, expect, it } from "vitest";
import { sniffImage } from "./image-sniff";

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("sniffImage", () => {
  it("recognises real image signatures", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffImage(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe("png");
    expect(sniffImage(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("webp");
    expect(sniffImage(bytes(0, 0, 0, 0x1c, "ftypavif"))).toBe("avif");
  });
  it("rejects an HTML/SVG file pretending to be an image", () => {
    expect(sniffImage(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(bytes("<!doctype html>"))).toBeNull();
  });
});
