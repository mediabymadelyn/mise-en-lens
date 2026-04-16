"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
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

type QuizStatus = "idle" | "correct" | "partial" | "retry";
type TutorTurn = {
  role: "tutor" | "user";
  text: string;
};

function isVagueAnswer(answer: string) {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return true;

  const vaguePatterns = [
    "idk",
    "i dont know",
    "i don't know",
    "not sure",
    "no idea",
    "maybe",
    "unsure",
    "dont know",
  ];

  return vaguePatterns.some((pattern) => normalized === pattern || normalized.includes(pattern));
}

function evaluateShortAnswer(question: ShortAnswerQuestion, answer: string): QuizStatus {
  const normalizedAnswer = answer.trim().toLowerCase();
  if (isVagueAnswer(normalizedAnswer)) {
    return "retry";
  }

  const acceptableAnswerHit = question.acceptableAnswers.some((item) =>
    normalizedAnswer.includes(item.toLowerCase())
  );
  const keywordMatches = question.acceptableKeywords.filter((keyword) =>
    normalizedAnswer.includes(keyword.toLowerCase())
  ).length;

  if (acceptableAnswerHit || keywordMatches >= Math.max(1, Math.ceil(question.acceptableKeywords.length / 3))) {
    return "correct";
  }

  if (keywordMatches >= 1 || normalizedAnswer.split(/\s+/).filter(Boolean).length >= 4) {
    return "partial";
  }

  return "retry";
}

function getFeedback(question: QuizQuestion, status: QuizStatus) {
  if (status === "correct") {
    return `${question.correctFeedback} Next step: keep using this lens on one scene.`;
  }

  if (status === "partial") {
    return `${question.partialFeedback} One refinement: answer in one sentence with one concrete cue.`;
  }

  if (status === "retry") {
    if (question.questionType === "multiple_choice") {
      return `${question.incorrectFeedback} Simpler follow-up: which option names a film technique, not plot summary?`;
    }

    return `${question.incorrectFeedback} Simpler follow-up: use this frame -> "I notice [technique] because [effect]."`;
  }

  return null;
}

function buildShortAnswerTutorMessage(
  question: ShortAnswerQuestion,
  status: QuizStatus,
  phase: "first_reply" | "followup_reply"
) {
  if (phase === "first_reply") {
    if (status === "correct") {
      return `${question.correctFeedback} You've got it. Ready for the next question?`;
    }

    if (status === "partial") {
      return `${question.partialFeedback}`;
    }

    return `${question.incorrectFeedback}`;
  }

  if (status === "correct") {
    return `${question.correctFeedback} Great. You've nailed this one. Move on when you're ready.`;
  }

  if (status === "partial") {
    return `${question.partialFeedback}`;
  }

  return "Here's the core idea: name one specific technique (like framing, sound, or color) and what feeling or attention it creates.";
}

export default function QuizPage() {
  const [username, setUsername] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<TutorQuizResponse | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState("");
  const [shortAnswer, setShortAnswer] = useState("");
  const [status, setStatus] = useState<QuizStatus>("idle");
  const [shortAnswerThread, setShortAnswerThread] = useState<TutorTurn[]>([]);
  const [awaitingFollowUp, setAwaitingFollowUp] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUsername(params.get("username")?.trim() ?? "");
  }, []);

  useEffect(() => {
    async function loadQuiz() {
      if (!username) {
        setError("Add a username in the URL to start the quiz.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const scrapeResponse = await fetch("/api/letterboxd/top4", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: username }),
        });

        const scrapePayload = (await scrapeResponse.json()) as Top4Response;
        if (!scrapePayload.ok) {
          setError(scrapePayload.error);
          setIsLoading(false);
          return;
        }

        const tutorResponse = await fetch("/api/tutor", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "quiz",
            username: scrapePayload.username,
            source_url: scrapePayload.source_url,
            films: scrapePayload.films,
            warning: scrapePayload.warning,
          }),
        });

        const tutorPayload = (await tutorResponse.json()) as TutorResponse;
        if (tutorPayload.ok && tutorPayload.mode === "quiz") {
          setQuizData(tutorPayload);
          setQuestionIndex(0);
          setSelectedOption("");
          setShortAnswer("");
          setStatus("idle");
          setShortAnswerThread([]);
          setAwaitingFollowUp(false);
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
  }, [username]);

  const activeQuestion = useMemo(() => {
    if (!quizData) return null;
    return quizData.quiz.questions[questionIndex] ?? null;
  }, [quizData, questionIndex]);

  const feedback = activeQuestion ? getFeedback(activeQuestion, status) : null;

  useEffect(() => {
    if (!activeQuestion || activeQuestion.questionType !== "short_answer") {
      setShortAnswerThread([]);
      setAwaitingFollowUp(false);
      return;
    }

    setShortAnswerThread([
      {
        role: "tutor",
        text: activeQuestion.prompt,
      },
    ]);
    setAwaitingFollowUp(false);
  }, [activeQuestion]);

  function handleSubmitAnswer() {
    if (!activeQuestion) return;

    if (activeQuestion.questionType === "multiple_choice") {
      if (!selectedOption) {
        setStatus("retry");
        return;
      }

      setStatus(selectedOption === activeQuestion.correctAnswer ? "correct" : "retry");
      return;
    }

    const trimmedAnswer = shortAnswer.trim();
    if (!trimmedAnswer) {
      setStatus("retry");
      setShortAnswerThread((current) => [
        ...current,
        {
          role: "tutor",
          text: "No worries. Give me one short sentence and we can build from there.",
        },
      ]);
      return;
    }

    const evaluation = evaluateShortAnswer(activeQuestion, trimmedAnswer);

    setShortAnswerThread((current) => {
      const withUserTurn: TutorTurn[] = [
        ...current,
        {
          role: "user",
          text: trimmedAnswer,
        },
      ];

      if (!awaitingFollowUp) {
        const tutorReply = buildShortAnswerTutorMessage(activeQuestion, evaluation, "first_reply");
        return [
          ...withUserTurn,
          {
            role: "tutor",
            text: tutorReply,
          },
        ];
      }

      const tutorReply = buildShortAnswerTutorMessage(activeQuestion, evaluation, "followup_reply");
      return [
        ...withUserTurn,
        {
          role: "tutor",
          text: tutorReply,
        },
      ];
    });

    setShortAnswer("");

    if (!awaitingFollowUp) {
      if (evaluation === "correct") {
        setStatus("correct");
        setAwaitingFollowUp(false);
        return;
      }

      setStatus(evaluation);
      setAwaitingFollowUp(true);
      return;
    }

    setAwaitingFollowUp(false);
    setStatus("correct");
  }

  function handleNextQuestion() {
    if (!quizData) return;
    if (questionIndex >= quizData.quiz.questions.length - 1) return;

    setQuestionIndex((current) => current + 1);
    setSelectedOption("");
    setShortAnswer("");
    setStatus("idle");
    setShortAnswerThread([]);
    setAwaitingFollowUp(false);
  }

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

                  <p className="text-sm leading-7 text-[var(--text-soft)]">{quizData.quiz.intro}</p>

                  {questionIndex === 5 ? (
                    <div className="rounded-[1.2rem] border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 px-4 py-3 text-sm leading-6 text-[#d4ebfa]">
                      <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-blue)]">
                        Concept before transfer
                      </p>
                      <p className="mt-2">
                        {quizData.quiz.transferConcept.explanation}
                      </p>
                    </div>
                  ) : null}

                  {quizData.warning ? (
                    <div className="rounded-[1.2rem] border border-[var(--accent-orange)]/25 bg-[var(--accent-orange)]/10 px-4 py-3 text-sm leading-6 text-[#ffd9b8]">
                      {quizData.warning}
                    </div>
                  ) : null}

                  <div className="rounded-[1.35rem] border border-white/10 bg-white/5 p-5">
                    <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[var(--accent-green)]">
                      Focus: {activeQuestion.focus}
                    </p>
                    <p className="mt-3 text-xl leading-8 text-white">{activeQuestion.prompt}</p>
                  </div>

                  {activeQuestion.questionType === "multiple_choice" ? (
                    <div className="grid gap-3">
                      {activeQuestion.options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSelectedOption(option)}
                          className={`rounded-[1.1rem] border px-4 py-4 text-left text-sm font-medium transition ${
                            selectedOption === option
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

                      <textarea
                        value={shortAnswer}
                        onChange={(event) => setShortAnswer(event.target.value)}
                        placeholder={
                          awaitingFollowUp
                            ? "Reply to the tutor follow-up in one short sentence."
                            : activeQuestion.placeholder
                        }
                        className="min-h-28 w-full rounded-[1.1rem] border border-white/12 bg-white/6 px-4 py-4 text-base text-white outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent-green)] focus:bg-white/8"
                      />
                      <p className="text-xs text-[var(--text-muted)]">
                        Keep it to about {activeQuestion.maxWords < 8 ? 15 : activeQuestion.maxWords} words or fewer.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleSubmitAnswer}
                      className="rounded-[1rem] bg-[var(--accent-green)] px-4 py-3 text-sm font-semibold text-[#1f232a] transition hover:brightness-105"
                    >
                      Submit answer
                    </button>
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      disabled={status !== "correct" || questionIndex >= quizData.quiz.questions.length - 1}
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
                        Why this question helps
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                        {activeQuestion.explanation}
                      </p>
                    </div>
                  </div>

                  {feedback && activeQuestion.questionType === "multiple_choice" ? (
                    <div
                      className={`rounded-[1.2rem] border px-4 py-4 text-sm leading-7 ${
                        status === "correct"
                          ? "border-[var(--accent-green)]/30 bg-[var(--accent-green)]/10 text-[#d7f8d8]"
                          : status === "partial"
                            ? "border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/10 text-[#d4ebfa]"
                            : "border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/10 text-[#ffd9b8]"
                      }`}
                    >
                      {feedback}
                    </div>
                  ) : null}

                  {questionIndex === quizData.quiz.questions.length - 1 && status !== "idle" ? (
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
