import { buildFallbackLesson, buildFallbackQuiz } from "@/lib/film-tutor/fallback";
import { generateLessonWithOpenAI, generateQuizWithOpenAI } from "@/lib/film-tutor/openai";
import type { FilmInput, TutorMode, TutorResponse } from "@/lib/film-tutor/types";
import { fetchWikiContextForFilms } from "@/lib/wikipedia/client";

export const runtime = "nodejs";

type TutorRequestBody = {
  mode?: TutorMode;
  username?: string;
  source_url?: string;
  warning?: string;
  films?: FilmInput[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TutorRequestBody;
    const films = body.films ?? [];
    const mode = body.mode === "quiz" ? "quiz" : "blurb";

    if (!body.username || !body.source_url || films.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "Missing profile data for lesson generation.",
        } satisfies TutorResponse,
        { status: 400 }
      );
    }

    let wikiContext: Map<string, import("@/lib/wikipedia/client").WikiFilmContext | null>;
    try {
      wikiContext = await fetchWikiContextForFilms(films.map((f) => f.title));
    } catch {
      console.warn("Wikipedia context fetch failed entirely; proceeding without it.");
      wikiContext = new Map();
    }

    try {
      if (mode === "quiz") {
        const quiz = await generateQuizWithOpenAI(films, wikiContext);

        // DIAGNOSTIC: log maxWords for each short-answer question before returning
        for (const q of quiz.questions) {
          if (q.questionType === "short_answer") {
            console.log(`[quiz diagnostic] question ${q.id} maxWords=${q.maxWords}`);
          }
        }

        return Response.json(
          {
            ok: true,
            generatedBy: "openai",
            mode,
            username: body.username,
            source_url: body.source_url,
            films,
            quiz,
            warning: body.warning,
          } satisfies TutorResponse,
          { status: 200 }
        );
      }

      const lesson = await generateLessonWithOpenAI(films, wikiContext);

      return Response.json(
        {
          ok: true,
          generatedBy: "openai",
          mode,
          username: body.username,
          source_url: body.source_url,
          films,
          lesson,
          warning: body.warning,
        } satisfies TutorResponse,
        { status: 200 }
      );
    } catch (error) {
      const openAiError = error instanceof Error ? error.message : "Unknown OpenAI error.";
      console.error("Tutor OpenAI generation failed; using fallback.", openAiError);

      const fallbackWarning =
        body.warning ??
        (process.env.NODE_ENV === "development"
          ? `Using the built-in lesson generator. OpenAI error: ${openAiError}`
          : "Using the built-in lesson generator. OpenAI request failed, so fallback content was used.");

      if (mode === "quiz") {
        const fallbackQuiz = buildFallbackQuiz(films, wikiContext);

        return Response.json(
          {
            ok: true,
            generatedBy: "fallback",
            mode,
            username: body.username,
            source_url: body.source_url,
            films,
            quiz: fallbackQuiz,
            warning: fallbackWarning,
          } satisfies TutorResponse,
          { status: 200 }
        );
      }

      const fallbackLesson = buildFallbackLesson(films, wikiContext);

      return Response.json(
        {
          ok: true,
          generatedBy: "fallback",
          mode,
          username: body.username,
          source_url: body.source_url,
          films,
          lesson: fallbackLesson,
          warning: fallbackWarning,
        } satisfies TutorResponse,
        { status: 200 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build tutor response.";

    return Response.json(
      {
        ok: false,
        error: message,
      } satisfies TutorResponse,
      { status: 500 }
    );
  }
}
