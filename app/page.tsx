"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import type { FilmInput, TutorLessonResponse, TutorResponse } from "@/lib/film-tutor/types";

type Top4Response =
  | {
      ok: true;
      username: string;
      source_url: string;
      films: Array<{
        title: string;
        film_url: string | null;
        poster_url: string | null;
      }>;
      warning?: string;
    }
  | {
      ok: false;
      error: string;
      films: [];
      username?: string;
    };

type WikiLookupResult =
  | { title: string; found: true; wikiTitle: string; description: string | null; thumbnailUrl: string | null; pageUrl: string }
  | { title: string; found: false };

type ConfirmedFilm = WikiLookupResult & { confirmed: boolean };

function cleanCardText(text: string): string {
  return text.replace(/\*/g, "").trim();
}

export default function Home() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [top4, setTop4] = useState<Top4Response | null>(null);
  const [lesson, setLesson] = useState<TutorLessonResponse | null>(null);

  // Manual entry state
  const [showManual, setShowManual] = useState(false);
  const [manualTitles, setManualTitles] = useState(["", "", "", ""]);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [confirmedFilms, setConfirmedFilms] = useState<ConfirmedFilm[] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefill = params.get("prefill");
    if (prefill) setInput(prefill);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = input.trim();
    if (!trimmed) {
      setTop4({ ok: false, error: "Enter a Letterboxd username or profile URL.", films: [] });
      setLesson(null);
      return;
    }

    setIsLoading(true);
    setTop4(null);
    setLesson(null);

    try {
      const scrapeResponse = await fetch("/api/letterboxd/top4", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });

      const scrapePayload = (await scrapeResponse.json()) as Top4Response;
      setTop4(scrapePayload);
      if (!scrapePayload.ok) return;

      const tutorResponse = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "blurb",
          username: scrapePayload.username,
          source_url: scrapePayload.source_url,
          films: scrapePayload.films,
          warning: scrapePayload.warning,
        }),
      });

      const tutorPayload = (await tutorResponse.json()) as TutorResponse;
      if (tutorPayload.ok && tutorPayload.mode === "blurb") {
        setLesson(tutorPayload);
        return;
      }
      setLesson(null);
    } catch {
      setTop4({
        ok: false,
        error: "The request failed. Check that the Next.js dev server is running.",
        films: [],
      });
      setLesson(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleManualLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const titles = manualTitles.map((t) => t.trim()).filter(Boolean);
    if (titles.length < 3) {
      setLookupError("Enter at least 3 film titles.");
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setConfirmedFilms(null);

    try {
      const res = await fetch("/api/manual/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles }),
      });
      const data = (await res.json()) as { ok: boolean; results?: WikiLookupResult[]; error?: string };
      if (!data.ok || !data.results) {
        setLookupError(data.error ?? "Lookup failed.");
        return;
      }
      setConfirmedFilms(data.results.map((r) => ({ ...r, confirmed: false })));
    } catch {
      setLookupError("The lookup failed. Try again.");
    } finally {
      setIsLookingUp(false);
    }
  }

  function handleManualConfirm() {
    if (!confirmedFilms) return;
    const films: FilmInput[] = confirmedFilms
      .filter((f) => f.found && f.confirmed)
      .map((f) => ({
        title: f.found ? f.wikiTitle : f.title,
        poster_url: f.found ? f.thumbnailUrl : null,
        film_url: null,
        source: "manual" as const,
      }));

    if (films.length < 3) {
      setLookupError("Confirm at least 3 films before continuing.");
      return;
    }

    sessionStorage.setItem("manualFilms", JSON.stringify(films));
    window.location.href = `/quiz?source=manual`;
  }

  return (
    <main className="min-h-screen px-4 py-6 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(49,57,70,0.96),rgba(31,37,46,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="grid gap-10 px-6 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-10">
            <div className="space-y-8">
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tracking-[0.28em] uppercase text-[var(--text-muted)]">
                  <span>Mise-en-Lens</span>
                  <span className="rounded-full border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/12 px-3 py-1 text-[var(--accent-blue)]">
                    Film literacy through taste
                  </span>
                </div>

                <div className="space-y-4">
                  <h1 className="max-w-4xl font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
                    Turn a Letterboxd Top 4 into a personalized lesson on film theory.
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-[var(--text-soft)]">
                    Paste a Letterboxd profile URL or username and Mise-en-Lens will pull the
                    Top 4, surface artistic and social context, and then offer a short guided
                    quiz on a separate page.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="sr-only" htmlFor="letterboxd-input">
                    Letterboxd username or profile URL
                  </label>
                  <input
                    id="letterboxd-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="wasabii444 or https://letterboxd.com/wasabii444/"
                    className="h-14 rounded-[1.25rem] border border-white/12 bg-white/6 px-5 text-base text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:bg-white/8"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-14 rounded-[1.25rem] bg-[var(--accent-orange)] px-6 text-base font-semibold text-[#1f232a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isLoading ? "Building lesson..." : "Pull Top 4"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowManual((v) => !v); setConfirmedFilms(null); setLookupError(null); }}
                  className="h-12 w-full rounded-[1.25rem] border border-[var(--accent-green)]/40 bg-[var(--accent-green)]/8 px-5 text-sm font-semibold text-[var(--accent-green)] transition hover:bg-[var(--accent-green)]/15"
                >
                  {showManual ? "Hide manual entry" : "No Letterboxd? Enter films manually"}
                </button>
              </form>

              {showManual ? (
                <div className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-green)]">
                    Manual film entry
                  </p>
                  <form onSubmit={handleManualLookup} className="space-y-3">
                    {manualTitles.map((title, i) => (
                      <div key={i}>
                        <label className="sr-only" htmlFor={`manual-film-${i}`}>
                          Favorite {i + 1}
                        </label>
                        <input
                          id={`manual-film-${i}`}
                          value={title}
                          onChange={(e) => {
                            const next = [...manualTitles];
                            next[i] = e.target.value;
                            setManualTitles(next);
                          }}
                          placeholder={i < 3 ? `Favorite ${i + 1} (required)` : `Favorite ${i + 1} (optional)`}
                          required={i < 3}
                          className="h-12 w-full rounded-[1.1rem] border border-white/12 bg-white/6 px-4 text-sm text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-green)] focus:bg-white/8"
                        />
                      </div>
                    ))}
                    {lookupError ? (
                      <p className="text-xs text-[#ffd9b8]">{lookupError}</p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={isLookingUp}
                      className="h-12 rounded-[1.1rem] bg-[var(--accent-green)] px-5 text-sm font-semibold text-[#1f232a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isLookingUp ? "Looking up films..." : "Look up films"}
                    </button>
                  </form>

                  {confirmedFilms ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                        Confirm your films
                      </p>
                      {confirmedFilms.map((film, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-3 rounded-[1.1rem] border p-3 transition ${
                            film.confirmed
                              ? "border-[var(--accent-green)]/40 bg-[var(--accent-green)]/8"
                              : "border-white/10 bg-white/4"
                          }`}
                        >
                          {film.found && film.thumbnailUrl ? (
                            <Image
                              src={film.thumbnailUrl}
                              alt={film.wikiTitle}
                              width={40}
                              height={60}
                              className="h-[60px] w-10 shrink-0 rounded-[0.5rem] object-cover"
                            />
                          ) : (
                            <div className="h-[60px] w-10 shrink-0 rounded-[0.5rem] bg-white/10" />
                          )}
                          <div className="min-w-0 flex-1">
                            {film.found ? (
                              <>
                                <p className="text-sm font-semibold text-white">{film.wikiTitle}</p>
                                {film.description ? (
                                  <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                                    {film.description}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-sm text-[#ffd9b8]">
                                Couldn&apos;t find &ldquo;{film.title}&rdquo;
                              </p>
                            )}
                          </div>
                          {film.found ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmedFilms((cur) =>
                                  cur
                                    ? cur.map((f, j) =>
                                        j === i ? { ...f, confirmed: !f.confirmed } : f
                                      )
                                    : cur
                                );
                              }}
                              className={`shrink-0 rounded-[0.8rem] border px-3 py-1.5 text-xs font-semibold transition ${
                                film.confirmed
                                  ? "border-[var(--accent-green)] bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                                  : "border-white/15 bg-white/6 text-[var(--text-soft)] hover:bg-white/10"
                              }`}
                            >
                              {film.confirmed ? "Confirmed" : "This is right"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...manualTitles];
                                next[i] = film.title;
                                setManualTitles(next);
                                setConfirmedFilms(null);
                              }}
                              className="shrink-0 rounded-[0.8rem] border border-white/15 bg-white/6 px-3 py-1.5 text-xs font-semibold text-[var(--text-soft)] transition hover:bg-white/10"
                            >
                              Try again
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleManualConfirm}
                        className="h-12 rounded-[1.1rem] bg-[var(--accent-orange)] px-5 text-sm font-semibold text-[#1f232a] transition hover:brightness-105"
                      >
                        Continue to quiz
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {lesson ? (
                <div className="flex justify-center py-1">
                  <svg
                    className="h-5 w-5 text-[var(--accent-green)] opacity-60 motion-safe:animate-bounce"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              ) : null}

              <div className="grid gap-4 text-sm text-[var(--text-soft)] sm:grid-cols-3">
                <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">1. Pull the Top 4</p>
                  <p className="mt-2 leading-6">
                    Use a Letterboxd username or profile link so the app can fetch posters and
                    titles automatically.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">2. Learn the patterns</p>
                  <p className="mt-2 leading-6">
                    Get a short analysis of genre, values, artistic form, and social context in
                    beginner-friendly language.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">3. Practice with quiz</p>
                  <p className="mt-2 leading-6">
                    Continue into a lighter, one-question-at-a-time quiz built around the same
                    films and visual language.
                  </p>
                </div>
              </div>
            </div>

            <aside className="rounded-[1.8rem] border border-white/10 bg-[#20252d] p-5 shadow-inner sm:p-6">
              {top4 && top4.ok ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-[0.24em] uppercase text-[var(--accent-orange)]">
                      Profile found
                    </p>
                    <h2 className="font-serif text-3xl">{top4.username}</h2>
                    <p className="text-sm break-all text-[var(--text-muted)]">{top4.source_url}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {top4.films.map((film, index) => {
                      const filmNote = lesson?.lesson.filmNotes.find((note) => note.title === film.title);
                      return (
                        <a
                          key={`${film.title}-${index}`}
                          href={film.film_url || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="overflow-hidden rounded-[1.15rem] border border-white/10 bg-[var(--panel)] transition hover:border-white/20"
                        >
                          <div className="aspect-[2/3] bg-black/20">
                            {film.poster_url ? (
                              <Image
                                src={film.poster_url}
                                alt={`Poster for ${film.title}`}
                                width={400}
                                height={600}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-[var(--text-muted)]">
                                Poster unavailable
                              </div>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[var(--accent-blue)]">
                              Favorite {index + 1}
                            </p>
                            <p className="mt-1 text-sm font-semibold leading-5 text-white">
                              {film.title}
                            </p>
                            {lesson ? (
                              <span className="mt-2 inline-flex rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">
                                {filmNote?.genreTag ?? "Film"}
                              </span>
                            ) : null}
                          </div>
                        </a>
                      );
                    })}
                  </div>

                  {lesson ? (
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-[var(--text-soft)]">
                      <p className="font-semibold text-white">{lesson.lesson.headline}</p>
                      <p className="mt-2">{lesson.lesson.overview}</p>
                    </div>
                  ) : null}
                </div>
              ) : top4 && !top4.ok ? (
                <div className="rounded-[1.3rem] border border-[var(--accent-orange)]/25 bg-[var(--accent-orange)]/10 px-4 py-4 text-sm leading-6 text-[#ffd9b8]">
                  {top4.error}
                </div>
              ) : (
                <div className="flex h-full min-h-[28rem] flex-col justify-between rounded-[1.5rem] border border-dashed border-white/12 bg-white/4 p-6">
                  <div className="space-y-4">
                    <p className="text-xs font-semibold tracking-[0.24em] uppercase text-[var(--accent-green)]">
                      Built around your design
                    </p>
                    <div className="space-y-3 text-sm leading-6 text-[var(--text-soft)]">
                      <p>Personalized analysis linked to the user&apos;s actual Top 4.</p>
                      <p>Artistic elements, social context, and a recommendation with educational redirection.</p>
                      <p>Quiz practice now continues on a focused page instead of sharing the lesson layout.</p>
                    </div>
                  </div>

                  <p className="text-sm text-[var(--text-muted)]">
                    Paste a profile to populate this panel with posters and the tutoring output.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </section>

        {lesson ? (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6 rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(49,57,70,0.98),rgba(39,45,54,0.98))] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[var(--accent-blue)]/14 px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                  Personalized blurb
                </span>
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase text-[var(--text-soft)]">
                  {lesson.generatedBy === "openai" ? "AI-generated" : "Built-in fallback"}
                </span>
              </div>

              <div className="space-y-4">
                <h2 className="font-serif text-3xl text-white sm:text-4xl">
                  {lesson.lesson.headline}
                </h2>
                <p className="max-w-3xl text-base leading-8 text-[var(--text-soft)]">
                  {lesson.lesson.overview}
                </p>
              </div>

              {lesson.warning ? (
                <div className="rounded-[1.2rem] border border-[var(--accent-orange)]/25 bg-[var(--accent-orange)]/10 px-4 py-3 text-sm leading-6 text-[#ffd9b8]">
                  {lesson.warning}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {lesson.lesson.tasteProfile.map((item) => (
                  <div key={item} className="rounded-full border border-white/20 bg-white/8 px-3 py-1.5">
                    <p className="text-xs leading-5 text-[var(--text-soft)]">{item}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-[#212831] p-5">
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-green)]">
                  Concept spotlight
                </p>
                <h3 className="mt-2 font-serif text-2xl text-white">{lesson.lesson.concept.name}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">
                  {lesson.lesson.concept.explanation}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  {lesson.lesson.concept.connection}
                </p>
              </div>

              <div className="grid gap-4">
                {lesson.lesson.filmNotes.map((note) => (
                  <article key={note.title} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-5">
                    <h3 className="font-serif text-2xl text-white">{note.title}</h3>
                    <span className="mt-2 inline-flex rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">
                      {note.genreTag ?? "Film"}
                    </span>
                    <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{cleanCardText(note.summary)}</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1rem] bg-black/15 p-4">
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-orange)]">
                          Artistic elements
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                          {cleanCardText(note.artisticElements)}
                        </p>
                      </div>
                      <div className="rounded-[1rem] bg-black/15 p-4">
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                          Societal context
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                          {cleanCardText(note.societalContext)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="flex justify-center py-1 lg:hidden">
                <svg
                  className="h-5 w-5 text-[var(--accent-blue)] opacity-60 motion-safe:animate-bounce"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <div className="space-y-6 rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(36,42,50,0.98),rgba(28,34,42,0.96))] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-8">
              <a
                href={lesson.lesson.recommendation.filmUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-[1.5rem] border border-white/10 bg-white/5 p-5 transition hover:border-white/20"
              >
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-orange)]">
                  Recommendation
                </p>
                <h2 className="mt-2 font-serif text-3xl text-white">
                  {lesson.lesson.recommendation.title}
                </h2>
                <span className="mt-2 inline-flex rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-soft)]">
                  {lesson.lesson.recommendation.genreTag ?? "Film"}
                </span>
                <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">
                  {cleanCardText(lesson.lesson.recommendation.whyYouMightLikeIt)}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  {cleanCardText(lesson.lesson.recommendation.educationalRedirect)}
                </p>
                {lesson.lesson.recommendation.posterUrl ? (
                  <div className="mt-4 rounded-[1rem] border border-white/10 overflow-hidden">
                    <img
                      src={lesson.lesson.recommendation.posterUrl}
                      alt={`Poster for ${lesson.lesson.recommendation.title}`}
                      className="w-full h-auto object-cover"
                    />
                  </div>
                ) : null}
              </a>

              <div className="rounded-[1.5rem] border border-white/10 bg-[#20252d] p-5">
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-green)]">
                  Practice next
                </p>
                <h2 className="mt-2 font-serif text-3xl text-white">Try the quiz</h2>
                <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
                  Continue on a dedicated quiz page with one question at a time, lighter prompts,
                  and faster feedback.
                </p>
                <div className="mt-5">
                  <Link
                    href={`/quiz?username=${encodeURIComponent(lesson.username)}`}
                    className="inline-flex items-center rounded-[1rem] bg-[var(--accent-green)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105"
                  >
                    Practice with quiz
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
