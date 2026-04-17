"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  FilmInput,
  QuizQuestion,
  ShortAnswerQuestion,
  TutorQuizResponse,
  TutorResponse,
} from "@/lib/film-tutor/types";

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

// Per-question state machine statuses
type QuestionStatus = "idle" | "correct" | "partial" | "confused" | "revealed";

type TutorTurn = {
  role: "tutor" | "user";
  text: string;
};

// Definitions shown when a user asks "what is a [concept]" instead of attempting an answer.
// These responses don't count as attempts.
const CONCEPT_DEFINITIONS: Record<string, string> = {
  theme:
    "A theme is the big idea a film keeps returning to — not the plot, but the subject underneath it. Family, identity, power, loss, belonging. Try: 'It explores [one word] because [one reason the film keeps coming back to it].'",
  technique:
    "A film technique is a deliberate choice the director makes — how close the camera is (framing), what you hear (sound design, silence), what colors appear, how fast scenes cut. Pick one you can actually point to on screen.",
  moment:
    "A moment just means one specific scene or shot that stood out — something that happened on screen, not a summary of the whole film. You don't need a technical term to name it.",
  mood:
    "Mood is the overall feeling the film creates — tense, warm, melancholic, unsettling. Think about how you felt watching it, not what the plot was.",
  tone:
    "Tone is how the film 'speaks' — serious, playful, cold, urgent. It's the emotional atmosphere the director builds through visual and sound choices.",
};

function detectConceptQuestion(answer: string): string | null {
  const n = answer.trim().toLowerCase();
  for (const [concept, definition] of Object.entries(CONCEPT_DEFINITIONS)) {
    if (
      n.includes(`what is a ${concept}`) ||
      n.includes(`what's a ${concept}`) ||
      n.includes(`what is ${concept}`) ||
      n.includes(`what does ${concept} mean`) ||
      n === `${concept}?` ||
      n === `define ${concept}`
    ) {
      return definition;
    }
  }
  if (n === "?" || n.includes("what does that mean") || n.includes("i don't understand the question")) {
    return "You can ask 'what is a theme', 'what is a technique', or 'what is a moment' and I'll explain it before you answer.";
  }
  return null;
}

const FILM_VOCAB = new Set([
  "framing", "close-up", "closeup", "wide shot", "long shot", "tracking",
  "montage", "editing", "cut", "cinematography", "lighting", "color",
  "sound", "silence", "score", "pacing", "composition", "blocking",
  "performance", "theme", "symbol", "motif", "genre", "atmosphere",
  "tension", "mood", "tone", "technique", "shot", "scene",
]);

function isVagueAnswer(answer: string): boolean {
  const n = answer.trim().toLowerCase();
  if (!n) return true;
  return [
    "idk", "i dont know", "i don't know", "not sure",
    "no idea", "maybe", "unsure", "dont know",
  ].some((p) => n === p || n.includes(p));
}

// Separate from vague — user is saying they can't recall, not that they don't know the concept
function isMemoryGap(answer: string): boolean {
  const n = answer.trim().toLowerCase();
  return [
    "i dont remember", "i don't remember", "i can't remember", "i cant remember",
    "i haven't seen", "i havent seen", "i don't recall", "i dont recall",
    "i forget", "i forgot", "never seen", "haven't watched", "havent watched",
  ].some((p) => n.includes(p));
}

function isOffTopic(
  answer: string,
  question: ShortAnswerQuestion,
  filmTitles: string[]
): boolean {
  const n = answer.trim().toLowerCase();
  // Anything 5+ words long shows genuine engagement — not off-topic
  if (n.split(/\s+/).filter(Boolean).length >= 5) return false;
  if (question.acceptableKeywords.some((k) => n.includes(k.toLowerCase()))) return false;
  if (filmTitles.some((t) => n.includes(t.toLowerCase()))) return false;
  return ![...FILM_VOCAB].some((w) => n.includes(w));
}

function evaluateShortAnswer(
  answer: string,
  question: ShortAnswerQuestion,
  filmTitles: string[]
): "correct" | "partial" | "confused" {
  const n = answer.trim().toLowerCase();
  const wordCount = n.split(/\s+/).filter(Boolean).length;

  if (isVagueAnswer(n) || isOffTopic(n, question, filmTitles)) {
    return "confused";
  }

  const acceptableHit = question.acceptableAnswers.some((a) => n.includes(a.toLowerCase()));
  const keywordMatches = question.acceptableKeywords.filter((k) =>
    n.includes(k.toLowerCase())
  ).length;

  if (
    acceptableHit ||
    keywordMatches >= Math.max(1, Math.ceil(question.acceptableKeywords.length / 3))
  ) {
    // Short single-concept answers (≤4 words) on questions that ask for TWO things
    // (theme + why, technique + feeling) are partial — the student needs to add reasoning
    const asksTwoThings = /\band\b/.test(question.prompt.toLowerCase()) &&
      (question.prompt.toLowerCase().includes("say why") ||
       question.prompt.toLowerCase().includes("what feeling") ||
       question.prompt.toLowerCase().includes("in one sentence"));
    if (asksTwoThings && wordCount <= 4) {
      return "partial";
    }
    return "correct";
  }

  // 5+ word answers that engaged with the question are partial, not confused
  if (keywordMatches >= 1 || wordCount >= 5) {
    return "partial";
  }

  return "confused";
}

export default function QuizPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<TutorQuizResponse | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  // MC state
  const [selectedOption, setSelectedOption] = useState("");

  // Short-answer state
  const [shortAnswer, setShortAnswer] = useState("");
  const [shortAnswerThread, setShortAnswerThread] = useState<TutorTurn[]>([]);

  // Per-question state machine
  const [questionStatus, setQuestionStatus] = useState<QuestionStatus>("idle");
  const [attempts, setAttempts] = useState(0);
  const [showFallbackMC, setShowFallbackMC] = useState(false);
  const [fallbackMCSelected, setFallbackMCSelected] = useState("");

  useEffect(() => {
    async function loadQuiz() {
      const params = new URLSearchParams(window.location.search);
      const source = params.get("source");
      const usernameParam = params.get("username")?.trim() ?? "";

      setIsLoading(true);
      setError(null);

      try {
        let films: FilmInput[];
        let quizUsername: string;
        let quizSourceUrl: string;

        if (source === "manual") {
          // Manual path: read confirmed films from sessionStorage
          const stored = sessionStorage.getItem("manualFilms");
          if (!stored) {
            setError("No films found. Please go back and enter your films.");
            setIsLoading(false);
            return;
          }
          films = JSON.parse(stored) as FilmInput[];
          quizUsername = "Manual entry";
          quizSourceUrl = "manual";
        } else {
          // Letterboxd path: scrape as before
          if (!usernameParam) {
            setError("Add a username in the URL to start the quiz.");
            setIsLoading(false);
            return;
          }
          const scrapeResponse = await fetch("/api/letterboxd/top4", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: usernameParam }),
          });

          const scrapePayload = (await scrapeResponse.json()) as Top4Response;
          if (!scrapePayload.ok) {
            setError(scrapePayload.error);
            setIsLoading(false);
            return;
          }

          films = scrapePayload.films.map((f) => ({ ...f, source: "letterboxd" as const }));
          quizUsername = scrapePayload.username;
          quizSourceUrl = scrapePayload.source_url;
        }

        const tutorResponse = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "quiz",
            username: quizUsername,
            source_url: quizSourceUrl,
            films,
          }),
        });

        const tutorPayload = (await tutorResponse.json()) as TutorResponse;
        if (tutorPayload.ok && tutorPayload.mode === "quiz") {
          setQuizData(tutorPayload);
          setQuestionIndex(0);
          setIsLoading(false);
          return;
        }

        setError("Unable to load the quiz.");
      } catch {
        setError("The quiz could not be loaded right now. Try again in a moment.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadQuiz();
  }, []);

  const activeQuestion = useMemo((): QuizQuestion | null => {
    if (!quizData) return null;
    return quizData.quiz.questions[questionIndex] ?? null;
  }, [quizData, questionIndex]);

  const filmTitles = useMemo(
    () => quizData?.films.map((f) => f.title) ?? [],
    [quizData]
  );

  // Reset all per-question state when the active question changes
  useEffect(() => {
    setSelectedOption("");
    setShortAnswer("");
    setQuestionStatus("idle");
    setAttempts(0);
    setShowFallbackMC(false);
    setFallbackMCSelected("");

    if (activeQuestion?.questionType === "short_answer") {
      setShortAnswerThread([{ role: "tutor", text: activeQuestion.prompt }]);
    } else {
      setShortAnswerThread([]);
    }
  }, [activeQuestion]);

  function handleSubmitAnswer() {
    if (!activeQuestion) return;

    if (activeQuestion.questionType === "multiple_choice") {
      if (!selectedOption) return;
      setQuestionStatus(selectedOption === activeQuestion.correctAnswer ? "correct" : "confused");
      return;
    }

    // Short answer — handle fallback MC submission separately
    if (showFallbackMC) return;

    const trimmed = shortAnswer.trim();
    if (!trimmed) {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "tutor", text: "No worries. Give me one short sentence and we can build from there." },
      ]);
      return;
    }

    // Concept questions ("what is a theme?") get a definition — not an attempt
    const conceptReply = detectConceptQuestion(trimmed);
    if (conceptReply) {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: trimmed },
        { role: "tutor", text: conceptReply },
      ]);
      setShortAnswer("");
      return;
    }

    // Memory gaps ("i don't remember the movie") get a prompt toward the hint — not an attempt
    if (isMemoryGap(trimmed)) {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: trimmed },
        {
          role: "tutor",
          text: `That's fine — use the hint below as a starting point. You can describe what you think might happen, or guess based on the genre. Even a rough answer is worth trying.`,
        },
      ]);
      setShortAnswer("");
      return;
    }

    const evaluation = evaluateShortAnswer(trimmed, activeQuestion, filmTitles);
    const newAttempts = attempts + 1;

    setShortAnswerThread((cur) => [...cur, { role: "user", text: trimmed }]);
    setShortAnswer("");
    setAttempts(newAttempts);

    if (evaluation === "correct") {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "tutor", text: activeQuestion.correctFeedback },
      ]);
      setQuestionStatus("correct");
      return;
    }

    // Second attempt exhausted
    if (newAttempts >= 2) {
      // Still confused at attempt 2 → offer fallback MC
      if (evaluation === "confused" || questionStatus === "confused") {
        setShortAnswerThread((cur) => [
          ...cur,
          { role: "tutor", text: "Let me give you some options to work with." },
        ]);
        setShowFallbackMC(true);
        return;
      }
      // Partial at attempt 2 → reveal
      const revealed = activeQuestion.acceptableAnswers[0] ?? "a specific technique or theme";
      setShortAnswerThread((cur) => [
        ...cur,
        {
          role: "tutor",
          text: `The answer is: ${revealed}. ${activeQuestion.incorrectFeedback} Let's keep going.`,
        },
      ]);
      setQuestionStatus("revealed");
      return;
    }

    // First attempt: enter scaffold or partial mode
    if (evaluation === "confused") {
      setShortAnswerThread((cur) => [
        ...cur,
        {
          role: "tutor",
          text: `Let's make it smaller. ${activeQuestion.scaffoldQuestion}`,
        },
      ]);
      setQuestionStatus("confused");
    } else {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "tutor", text: activeQuestion.partialFeedback },
      ]);
      setQuestionStatus("partial");
    }
  }

  function handleFallbackMCSubmit() {
    if (!activeQuestion || activeQuestion.questionType !== "short_answer") return;
    const mc = activeQuestion.fallbackMultipleChoice;
    if (!fallbackMCSelected) return;

    if (fallbackMCSelected === mc.correctAnswer) {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: fallbackMCSelected },
        { role: "tutor", text: `${mc.explanation} ${activeQuestion.correctFeedback}` },
      ]);
      setQuestionStatus("correct");
    } else {
      setShortAnswerThread((cur) => [
        ...cur,
        { role: "user", text: fallbackMCSelected },
        {
          role: "tutor",
          text: `The answer is: ${mc.correctAnswer}. ${mc.explanation} Let's keep going.`,
        },
      ]);
      setQuestionStatus("revealed");
    }
    setShowFallbackMC(false);
    setFallbackMCSelected("");
  }

  function handleNextQuestion() {
    if (!quizData) return;
    if (questionIndex >= quizData.quiz.questions.length - 1) return;
    setQuestionIndex((i) => i + 1);
  }

  const canAdvance =
    questionStatus === "correct" || questionStatus === "revealed";

  const isLastQuestion =
    quizData != null && questionIndex >= quizData.quiz.questions.length - 1;

  // Determine hint text: use scaffold hint when confused at attempt 1
  const hintText =
    activeQuestion &&
    questionStatus === "confused" &&
    !showFallbackMC &&
    activeQuestion.questionType === "short_answer"
      ? activeQuestion.scaffoldHint
      : activeQuestion?.hint ?? "";

  return (
    <main className="min-h-screen px-4 py-6 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(49,57,70,0.96),rgba(31,37,46,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-10">
            <aside className="space-y-5 rounded-[1.8rem] border border-white/10 bg-[#20252d] p-5 shadow-inner sm:p-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tracking-[0.28em] uppercase text-[var(--text-muted)]">
                  <span>Mise-en-Lens</span>
                  <span className="rounded-full border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/12 px-3 py-1 text-[var(--accent-green)]">
                    Quiz flow
                  </span>
                </div>
                <h1 className="font-serif text-4xl leading-tight text-white">Practice with your Top 4</h1>
                <p className="text-sm leading-7 text-[var(--text-soft)]">
                  One question at a time, lighter prompts, and quick feedback that keeps the focus
                  on learning instead of long-form writing.
                </p>
              </div>

              {quizData ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-orange)]">
                      Profile
                    </p>
                    <h2 className="font-serif text-2xl text-white">{quizData.username}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {quizData.films.map((film, index) => (
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

                  <Link
                    href={`/?prefill=${encodeURIComponent(quizData.username)}`}
                    className="inline-flex items-center rounded-[1rem] border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-[var(--text-soft)] transition hover:bg-white/10"
                  >
                    Back to lesson
                  </Link>
                </div>
              ) : (
                <div className="rounded-[1.2rem] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-[var(--text-soft)]">
                  The quiz loads from the username in the URL so the lesson and quiz can stay on
                  separate pages without changing the overall app structure.
                </div>
              )}
            </aside>

            <div className="space-y-6 rounded-[1.8rem] border border-white/10 bg-[linear-gradient(160deg,rgba(36,42,50,0.98),rgba(28,34,42,0.96))] p-6 sm:p-8">
              {isLoading ? (
                <div className="space-y-4">
                  <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-blue)]">
                    Loading quiz
                  </p>
                  <h2 className="font-serif text-3xl text-white">Building your guided practice</h2>
                  <p className="max-w-2xl text-sm leading-7 text-[var(--text-soft)]">
                    Pulling the profile and generating a lighter set of quiz questions.
                  </p>
                </div>
              ) : error ? (
                <div className="rounded-[1.3rem] border border-[var(--accent-orange)]/25 bg-[var(--accent-orange)]/10 px-4 py-4 text-sm leading-6 text-[#ffd9b8]">
                  <p>{error}</p>
                  <div className="mt-4">
                    <Link
                      href="/"
                      className="inline-flex items-center rounded-[1rem] bg-[var(--accent-orange)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105"
                    >
                      Return home
                    </Link>
                  </div>
                </div>
              ) : quizData && activeQuestion ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[var(--accent-blue)]">
                        {quizData.quiz.title}
                      </p>
                      <h2 className="mt-2 font-serif text-3xl text-white">Question {questionIndex + 1}</h2>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-[var(--text-soft)]">
                      {questionIndex + 1}/{quizData.quiz.questions.length}
                    </div>
                  </div>

                  {/* Transfer teach block — shown before Q5 (index 4) */}
                  {questionIndex === 4 ? (
                    <div className="rounded-[1.2rem] border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 px-4 py-3 text-sm leading-6 text-[#d4ebfa]">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                        Learn this first
                      </p>
                      <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--accent-blue)]/60">
                        {quizData.quiz.transferConcept.concept} &mdash; {quizData.quiz.transferConcept.filmA}
                      </p>
                      <p className="mt-2">
                        {quizData.quiz.transferConcept.teachStatement}
                      </p>
                    </div>
                  ) : null}

                  {quizData.warning ? (
                    <div className="rounded-[1.2rem] border border-[var(--accent-orange)]/25 bg-[var(--accent-orange)]/10 px-4 py-3 text-sm leading-6 text-[#ffd9b8]">
                      {quizData.warning}
                    </div>
                  ) : null}

                  {/* Question prompt — dimmed when scaffold is active */}
                  <div
                    className={`rounded-[1.35rem] border border-white/10 bg-white/5 p-5 transition ${
                      questionStatus === "confused" && activeQuestion.questionType === "short_answer"
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-green)]">
                      Focus: {activeQuestion.focus}
                    </p>
                    <p className="mt-3 text-xl leading-8 text-white">{activeQuestion.prompt}</p>
                  </div>

                  {/* Scaffold prompt — shown when confused (attempt 1, no fallback MC yet) */}
                  {questionStatus === "confused" &&
                    activeQuestion.questionType === "short_answer" &&
                    !showFallbackMC ? (
                    <div className="rounded-[1.2rem] border border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/8 px-4 py-3 text-sm leading-6 text-[#ffd9b8]">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-orange)]">
                        Simpler step
                      </p>
                      <p className="mt-2">{activeQuestion.scaffoldQuestion}</p>
                    </div>
                  ) : null}

                  {/* Revealed answer panel */}
                  {questionStatus === "revealed" ? (
                    <div className="rounded-[1.2rem] border border-white/20 bg-white/8 px-4 py-4 text-sm leading-6 text-white">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--text-muted)]">
                        Answer
                      </p>
                      <p className="mt-2">
                        {activeQuestion.questionType === "short_answer"
                          ? activeQuestion.acceptableAnswers[0] ?? "See the hint above."
                          : activeQuestion.correctAnswer}
                      </p>
                    </div>
                  ) : null}

                  {activeQuestion.questionType === "multiple_choice" ? (
                    <div className="grid gap-3">
                      {activeQuestion.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          disabled={questionStatus !== "idle" && questionStatus !== "confused"}
                          onClick={() => setSelectedOption(option)}
                          className={`rounded-[1.1rem] border px-4 py-4 text-left text-sm font-medium transition ${
                            questionStatus === "correct" && option === activeQuestion.correctAnswer
                              ? "border-[var(--accent-green)] bg-[var(--accent-green)]/12 text-white"
                              : questionStatus !== "idle" && questionStatus !== "confused" && option === activeQuestion.correctAnswer
                                ? "border-[var(--accent-green)]/50 bg-[var(--accent-green)]/6 text-white"
                                : selectedOption === option
                                  ? "border-[var(--accent-green)] bg-[var(--accent-green)]/12 text-white"
                                  : "border-white/10 bg-white/5 text-[var(--text-soft)] hover:bg-white/8"
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Conversation thread */}
                      <div className="space-y-2 rounded-[1.1rem] border border-white/10 bg-white/5 p-3">
                        {shortAnswerThread.map((turn, index) => (
                          <div
                            key={`${turn.role}-${index}`}
                            className={`max-w-[92%] rounded-[0.9rem] px-3 py-2 text-sm leading-6 ${
                              turn.role === "tutor"
                                ? "border border-white/10 bg-black/20 text-[var(--text-soft)]"
                                : "ml-auto border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/12 text-white"
                            }`}
                          >
                            {turn.text}
                          </div>
                        ))}
                      </div>

                      {/* Fallback MC — replaces textarea when confused at attempt 2 */}
                      {showFallbackMC ? (
                        <div className="space-y-3 rounded-[1.1rem] border border-white/10 bg-white/5 p-4">
                          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                            Pick one
                          </p>
                          <p className="text-sm leading-6 text-white">
                            {activeQuestion.fallbackMultipleChoice.prompt}
                          </p>
                          <div className="grid gap-2">
                            {activeQuestion.fallbackMultipleChoice.options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setFallbackMCSelected(opt)}
                                className={`rounded-[1rem] border px-4 py-3 text-left text-sm font-medium transition ${
                                  fallbackMCSelected === opt
                                    ? "border-[var(--accent-green)] bg-[var(--accent-green)]/12 text-white"
                                    : "border-white/10 bg-white/5 text-[var(--text-soft)] hover:bg-white/8"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleFallbackMCSubmit}
                            disabled={!fallbackMCSelected}
                            className="rounded-[1rem] bg-[var(--accent-green)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Submit
                          </button>
                        </div>
                      ) : questionStatus !== "correct" && questionStatus !== "revealed" ? (
                        <>
                          <textarea
                            value={shortAnswer}
                            onChange={(e) => setShortAnswer(e.target.value)}
                            placeholder={activeQuestion.placeholder}
                            className="min-h-28 w-full rounded-[1.1rem] border border-white/12 bg-white/6 px-4 py-4 text-base text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-green)] focus:bg-white/8"
                          />
                          <p className="text-xs text-[var(--text-muted)]">
                            Keep it to about {activeQuestion.maxWords < 8 ? 15 : activeQuestion.maxWords} words or fewer.
                          </p>
                        </>
                      ) : null}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {!showFallbackMC ? (
                      <button
                        type="button"
                        onClick={handleSubmitAnswer}
                        disabled={
                          canAdvance ||
                          (activeQuestion.questionType === "multiple_choice" && !selectedOption)
                        }
                        className="rounded-[1rem] bg-[var(--accent-green)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Submit answer
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      disabled={!canAdvance || isLastQuestion}
                      className="rounded-[1rem] border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-[var(--text-soft)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Next question
                    </button>
                  </div>

                  {hintText ? (
                    <div
                      className={`rounded-[1rem] bg-black/15 p-4 transition ${
                        questionStatus === "revealed" ? "opacity-50" : ""
                      }`}
                    >
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-orange)]">
                        Hint
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                        {hintText}
                      </p>
                    </div>
                  ) : null}

                  {/* MC feedback panel */}
                  {activeQuestion.questionType === "multiple_choice" && questionStatus !== "idle" ? (
                    <div
                      className={`rounded-[1.2rem] border px-4 py-4 text-sm leading-7 ${
                        questionStatus === "correct"
                          ? "border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[#d7f8d8]"
                          : "border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/10 text-[#ffd9b8]"
                      }`}
                    >
                      {questionStatus === "correct"
                        ? activeQuestion.correctFeedback
                        : activeQuestion.incorrectFeedback}
                    </div>
                  ) : null}

                  {isLastQuestion && canAdvance ? (
                    <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-[var(--text-soft)]">
                      You reached the final question. You can return to the lesson or stay here and
                      revise your answer before moving on.
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
