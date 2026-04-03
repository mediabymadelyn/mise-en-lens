"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

type TutorMode = "blurb" | "quiz";

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

type TutorResponse =
  | {
      ok: true;
      generatedBy: "openai" | "fallback";
      mode: TutorMode;
      username: string;
      source_url: string;
      films: Array<{
        title: string;
        film_url: string | null;
        poster_url: string | null;
      }>;
      lesson: {
        headline: string;
        overview: string;
        tasteProfile: string[];
        concept: {
          name: string;
          explanation: string;
          connection: string;
        };
        filmNotes: Array<{
          title: string;
          summary: string;
          artisticElements: string;
          societalContext: string;
        }>;
        recommendation: {
          title: string;
          whyYouMightLikeIt: string;
          educationalRedirect: string;
        };
        quiz: {
          intro: string;
          questions: Array<{
            id: string;
            prompt: string;
            focus: string;
            hint: string;
            expectedAnswer: string;
            acceptableKeywords: string[];
            correctFeedback: string;
            partialFeedback: string;
            incorrectFeedback: string;
          }>;
        };
      };
      warning?: string;
    }
  | {
      ok: false;
      error: string;
    };

type QuizStatus = "idle" | "correct" | "partial" | "retry";

function evaluateAnswer(answer: string, keywords: string[]) {
  const normalizedAnswer = answer.toLowerCase();
  const uniqueKeywords = Array.from(new Set(keywords.map((keyword) => keyword.toLowerCase())));
  const matches = uniqueKeywords.filter((keyword) => normalizedAnswer.includes(keyword)).length;

  if (matches >= Math.max(2, Math.ceil(uniqueKeywords.length / 2))) {
    return "correct" as const;
  }

  if (matches >= 1 || normalizedAnswer.split(/\s+/).filter(Boolean).length >= 10) {
    return "partial" as const;
  }

  return "retry" as const;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<TutorMode>("blurb");
  const [isLoading, setIsLoading] = useState(false);
  const [top4, setTop4] = useState<Top4Response | null>(null);
  const [lesson, setLesson] = useState<TutorResponse | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizStatus, setQuizStatus] = useState<QuizStatus>("idle");

  const activeQuestion = useMemo(() => {
    if (!lesson || !lesson.ok) return null;
    return lesson.lesson.quiz.questions[quizIndex] ?? null;
  }, [lesson, quizIndex]);

  const quizFeedback = useMemo(() => {
    if (!activeQuestion || quizStatus === "idle") return null;

    if (quizStatus === "correct") {
      return activeQuestion.correctFeedback;
    }

    if (quizStatus === "partial") {
      return activeQuestion.partialFeedback;
    }

    return activeQuestion.incorrectFeedback;
  }, [activeQuestion, quizStatus]);

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
    setQuizIndex(0);
    setQuizAnswer("");
    setQuizStatus("idle");

    try {
      const scrapeResponse = await fetch("/api/letterboxd/top4", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: trimmed }),
      });

      const scrapePayload = (await scrapeResponse.json()) as Top4Response;
      setTop4(scrapePayload);

      if (!scrapePayload.ok) {
        return;
      }

      const tutorResponse = await fetch("/api/tutor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          username: scrapePayload.username,
          source_url: scrapePayload.source_url,
          films: scrapePayload.films,
          warning: scrapePayload.warning,
        }),
      });

      const tutorPayload = (await tutorResponse.json()) as TutorResponse;
      setLesson(tutorPayload);
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

  function handleCheckAnswer() {
    if (!activeQuestion) return;
    setQuizStatus(evaluateAnswer(quizAnswer, activeQuestion.acceptableKeywords));
  }

  function handleNextQuestion() {
    if (!lesson || !lesson.ok) return;
    if (quizIndex >= lesson.lesson.quiz.questions.length - 1) return;

    setQuizIndex((current) => current + 1);
    setQuizAnswer("");
    setQuizStatus("idle");
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
                    Top 4, surface artistic and social context, and optionally turn those films
                    into a short quiz with immediate feedback.
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

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("blurb")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      mode === "blurb"
                        ? "bg-[var(--accent-blue)] text-[#1f232a]"
                        : "border border-white/12 bg-white/6 text-[var(--text-soft)]"
                    }`}
                  >
                    Summary mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("quiz")}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      mode === "quiz"
                        ? "bg-[var(--accent-green)] text-[#1f232a]"
                        : "border border-white/12 bg-white/6 text-[var(--text-soft)]"
                    }`}
                  >
                    Quiz mode
                  </button>
                </div>
              </form>

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
                  <p className="font-semibold text-white">3. Practice transfer</p>
                  <p className="mt-2 leading-6">
                    Switch to quiz mode to test interpretation, creative choices, and film-theory
                    vocabulary with immediate feedback.
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
                    {top4.films.map((film, index) => (
                      <div
                        key={`${film.title}-${index}`}
                        className="overflow-hidden rounded-[1.15rem] border border-white/10 bg-[var(--panel)]"
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
                        </div>
                      </div>
                    ))}
                  </div>

                  {lesson && lesson.ok ? (
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
                      <p>Optional quiz mode with immediate feedback and gentle scaffolding.</p>
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

        {lesson && lesson.ok ? (
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

              <div className="grid gap-4 md:grid-cols-3">
                {lesson.lesson.tasteProfile.map((item) => (
                  <div key={item} className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm leading-6 text-[var(--text-soft)]">{item}</p>
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
                    <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">{note.summary}</p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1rem] bg-black/15 p-4">
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-orange)]">
                          Artistic elements
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                          {note.artisticElements}
                        </p>
                      </div>
                      <div className="rounded-[1rem] bg-black/15 p-4">
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                          Societal context
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                          {note.societalContext}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="space-y-6 rounded-[2rem] border border-white/10 bg-[linear-gradient(160deg,rgba(36,42,50,0.98),rgba(28,34,42,0.96))] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-8">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-orange)]">
                  Recommendation
                </p>
                <h2 className="mt-2 font-serif text-3xl text-white">
                  {lesson.lesson.recommendation.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-[var(--text-soft)]">
                  {lesson.lesson.recommendation.whyYouMightLikeIt}
                </p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  {lesson.lesson.recommendation.educationalRedirect}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-[#20252d] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-green)]">
                      Quiz studio
                    </p>
                    <h2 className="mt-2 font-serif text-3xl text-white">Immediate feedback</h2>
                  </div>
                  <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-[var(--text-soft)]">
                    Question {quizIndex + 1}/{lesson.lesson.quiz.questions.length}
                  </div>
                </div>

                <p className="mt-4 text-sm leading-7 text-[var(--text-soft)]">
                  {lesson.lesson.quiz.intro}
                </p>

                {activeQuestion ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                        Focus: {activeQuestion.focus}
                      </p>
                      <p className="mt-3 text-base leading-7 text-white">{activeQuestion.prompt}</p>
                    </div>

                    <textarea
                      value={quizAnswer}
                      onChange={(event) => setQuizAnswer(event.target.value)}
                      placeholder="Write your interpretation here..."
                      className="min-h-36 w-full rounded-[1.2rem] border border-white/12 bg-white/6 px-4 py-4 text-base text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-green)] focus:bg-white/8"
                    />

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleCheckAnswer}
                        className="rounded-[1rem] bg-[var(--accent-green)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105"
                      >
                        Check answer
                      </button>
                      <button
                        type="button"
                        onClick={handleNextQuestion}
                        disabled={quizIndex >= lesson.lesson.quiz.questions.length - 1}
                        className="rounded-[1rem] border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-[var(--text-soft)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Next question
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[1rem] bg-black/15 p-4">
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-orange)]">
                          Hint
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                          {activeQuestion.hint}
                        </p>
                      </div>
                      <div className="rounded-[1rem] bg-black/15 p-4">
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                          What a strong answer does
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                          {activeQuestion.expectedAnswer}
                        </p>
                      </div>
                    </div>

                    {quizFeedback ? (
                      <div
                        className={`rounded-[1.2rem] border px-4 py-4 text-sm leading-7 ${
                          quizStatus === "correct"
                            ? "border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[#d7f8d8]"
                            : quizStatus === "partial"
                              ? "border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 text-[#d4ebfa]"
                              : "border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/10 text-[#ffd9b8]"
                        }`}
                      >
                        {quizFeedback}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
