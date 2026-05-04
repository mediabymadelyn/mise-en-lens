import { describe, it, expect } from "vitest";
import { filterAcceptableKeywords } from "@/lib/film-tutor/keyword-filter";

describe("filterAcceptableKeywords", () => {
  it("removes stop words from the list", () => {
    const result = filterAcceptableKeywords(["shows", "family", "scene", "power"]);
    expect(result).not.toContain("shows");
    expect(result).not.toContain("scene");
    expect(result).toContain("family");
    expect(result).toContain("power");
  });

  it("is case-insensitive when matching stop words", () => {
    const result = filterAcceptableKeywords(["Shows", "SCENE", "Reveals", "Family"]);
    expect(result).not.toContain("Shows");
    expect(result).not.toContain("SCENE");
    expect(result).not.toContain("Reveals");
    expect(result).toContain("Family");
  });

  it("returns empty array when all inputs are stop words", () => {
    const result = filterAcceptableKeywords(["shows", "reveals", "moment", "scene", "because", "when"]);
    expect(result).toHaveLength(0);
  });

  it("preserves all keywords when none are stop words", () => {
    const result = filterAcceptableKeywords(["family", "identity", "grief", "isolation"]);
    expect(result).toHaveLength(4);
    expect(result).toEqual(["family", "identity", "grief", "isolation"]);
  });

  it("returns empty array for empty input", () => {
    expect(filterAcceptableKeywords([])).toHaveLength(0);
  });
});
