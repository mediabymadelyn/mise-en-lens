import { describe, it, expect } from "vitest";
import { buildFallbackLesson, buildFallbackQuiz } from "@/lib/film-tutor/fallback";
import type { FilmInput } from "@/lib/film-tutor/types";
import type { WikiFilmContext } from "@/lib/wikipedia/client";

const horrorFilms: FilmInput[] = [
  { title: "Get Out", poster_url: null, film_url: null, source: "manual" },
  { title: "Hereditary", poster_url: null, film_url: null, source: "manual" },
  { title: "Midsommar", poster_url: null, film_url: null, source: "manual" },
  { title: "The Babadook", poster_url: null, film_url: null, source: "manual" },
];

const getOutWikiCtx: WikiFilmContext = {
  filmTitle: "Get Out",
  wikiTitle: "Get Out (film)",
  extract: "Get Out is a 2017 horror film written and directed by Jordan Peele.",
  description: "2017 film by Jordan Peele",
  pageUrl: "https://en.wikipedia.org/wiki/Get_Out",
  plot: "Chris Washington travels with his girlfriend Rose to meet her parents. The family traps him in a sunken place.",
  themes: "Themes of racism, identity, and psychological control.",
  thumbnailUrl: null,
};

describe("buildFallbackLesson", () => {
  it("returns a structurally valid lesson payload with no wiki context", () => {
    const lesson = buildFallbackLesson(horrorFilms);
    expect(lesson.headline).toBeTruthy();
    expect(lesson.overview).toBeTruthy();
    expect(lesson.tasteProfile).toHaveLength(3);
    expect(lesson.filmNotes).toHaveLength(4);
    expect(lesson.concept.name).toBeTruthy();
    expect(lesson.recommendation.title).toBeTruthy();
  });

  it("uses wiki plot in film note summary when wiki context is provided", () => {
    const wikiContext = new Map<string, WikiFilmContext | null>([
      ["Get Out", getOutWikiCtx],
      ["Hereditary", null],
      ["Midsommar", null],
      ["The Babadook", null],
    ]);
    const lesson = buildFallbackLesson(horrorFilms, wikiContext);
    const getOutNote = lesson.filmNotes.find((n) => n.title === "Get Out");
    expect(getOutNote?.summary).toContain("Chris Washington");
  });

  it("falls back to generic summary when wiki context is absent for a film", () => {
    const lesson = buildFallbackLesson(horrorFilms);
    const note = lesson.filmNotes[1];
    expect(note.summary).toContain("reinforces the pattern");
  });

  it("detects horror archetype from film titles and selects appropriate concept", () => {
    const lesson = buildFallbackLesson(horrorFilms);
    expect(lesson.concept.name.toLowerCase()).toContain("tension");
  });
});

describe("buildFallbackQuiz", () => {
  it("returns a quiz with exactly 9 questions and no wiki context", () => {
    const quiz = buildFallbackQuiz(horrorFilms);
    expect(quiz.questions).toHaveLength(9);
  });

  it("includes required top-level fields", () => {
    const quiz = buildFallbackQuiz(horrorFilms);
    expect(quiz.title).toBeTruthy();
    expect(quiz.intro).toBeTruthy();
    expect(quiz.transferConcept.concept).toBeTruthy();
    expect(quiz.transferConcept.filmA).toBe("Get Out");
    expect(quiz.transferConcept.filmB).toBe("Hereditary");
  });

  it("every question has id, prompt, and a valid filmInFocus", () => {
    const quiz = buildFallbackQuiz(horrorFilms);
    const validTitles = new Set(horrorFilms.map((f) => f.title));
    for (const q of quiz.questions) {
      expect(q.id).toBeTruthy();
      expect(q.prompt).toBeTruthy();
      expect(validTitles.has(q.filmInFocus)).toBe(true);
    }
  });

  it("Q7 is multiple_choice and Q8 is short_answer", () => {
    const quiz = buildFallbackQuiz(horrorFilms);
    const q7 = quiz.questions.find((q) => q.id === "q7");
    const q8 = quiz.questions.find((q) => q.id === "q8");
    expect(q7?.questionType).toBe("multiple_choice");
    expect(q8?.questionType).toBe("short_answer");
  });
});
