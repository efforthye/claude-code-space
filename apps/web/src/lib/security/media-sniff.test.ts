import { describe, expect, it } from "vitest";
import { sniffImage, sniffMedia } from "./media-sniff";

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === "string" ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe("sniffMedia", () => {
  it("recognises image signatures", () => {
    expect(sniffMedia(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(sniffMedia(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))?.ext).toBe("png");
    expect(sniffMedia(bytes("RIFF", 0, 0, 0, 0, "WEBP"))?.ext).toBe("webp");
    expect(sniffMedia(bytes(0, 0, 0, 0x1c, "ftypavif"))?.ext).toBe("avif");
  });
  it("recognises video and 3D", () => {
    expect(sniffMedia(bytes(0, 0, 0, 0x20, "ftypisom"))).toMatchObject({ kind: "video", ext: "mp4" });
    expect(sniffMedia(bytes(0, 0, 0, 0x1c, "ftypM4V "))).toMatchObject({ kind: "video", ext: "mp4" });
    expect(sniffMedia(bytes(0x1a, 0x45, 0xdf, 0xa3))).toMatchObject({ kind: "video", ext: "webm" });
    expect(sniffMedia(bytes("glTF", 2, 0, 0, 0))).toMatchObject({ kind: "model", ext: "glb" });
  });
  it("rejects HTML/SVG and unknown ISO brands", () => {
    expect(sniffMedia(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffMedia(bytes("<!doctype html>"))).toBeNull();
    expect(sniffMedia(bytes(0, 0, 0, 0x1c, "ftypheic"))).toBeNull();
  });
  it("sniffImage only accepts images", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(sniffImage(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBeNull();
  });
});
