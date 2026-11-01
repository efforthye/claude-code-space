import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("neutralises formula-looking text", () => {
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
  });
  it("leaves numbers and plain text alone", () => {
    expect(csvCell(150000)).toBe(`"150000"`);
    expect(csvCell("두드린 그릇")).toBe(`"두드린 그릇"`);
  });
});
