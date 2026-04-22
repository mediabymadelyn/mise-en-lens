import { buildFallbackLesson, buildFallbackQuiz } from "@/lib/film-tutor/fallback";
import { generateLessonWithOpenAI, generateQuizWithOpenAI } from "@/lib/film-tutor/openai";
import type { FilmInput, TutorLessonPayload, TutorMode, TutorResponse } from "@/lib/film-tutor/types";
import { fetchWikiContextForFilms, type WikiFilmContext } from "@/lib/wikipedia/client";

export const runtime = "nodejs";

type TutorRequestBody = {
  mode?: TutorMode;
  username?: string;
  source_url?: string;
  warning?: string;
  films?: FilmInput[];
};

function deriveGenreTagFromWiki(ctx: WikiFilmContext | null | undefined): string | null {
  if (!ctx) return null;

  // Prefer summary metadata-style description first; fall back to extract.
  const metadataText = `${ctx.description ?? ""} ${ctx.extract ?? ""}`.toLowerCase();
  const rules: Array<{ label: string; terms: string[] }> = [
    { label: "Animation", terms: ["animated", "animation", "anime"] },
    { label: "Horror", terms: ["horror", "supernatural", "slasher"] },
    { label: "Thriller", terms: ["thriller", "psychological thriller", "suspense"] },
    { label: "Sci-Fi", terms: ["science fiction", "sci-fi", "dystopian"] },
    { label: "Fantasy", terms: ["fantasy", "magical", "fairy tale", "fairytale"] },
    { label: "Crime", terms: ["crime", "gangster", "detective", "noir"] },
    { label: "Action", terms: ["action", "martial arts", "war film"] },
    { label: "Romance", terms: ["romance", "romantic"] },
    { label: "Comedy", terms: ["comedy", "satirical", "black comedy"] },
    { label: "Documentary", terms: ["documentary", "docudrama"] },
    { label: "Drama", terms: ["drama", "coming-of-age", "coming of age"] },
  ];

  const matched = rules
    .filter((rule) => rule.terms.some((term) => metadataText.includes(term)))
    .map((rule) => rule.label);

  if (matched.length === 0) return null;
  if (matched.length === 1) return matched[0];

  const firstTwo = matched.slice(0, 2);
  const fusionKey = [...firstTwo].sort().join("|");
  const fusionLabels: Record<string, string> = {
    "Comedy|Drama": "Comedy-Drama",
    "Horror|Thriller": "Horror-Thriller",
    "Action|Sci-Fi": "Sci-Fi Action",
    "Drama|Romance": "Romance-Drama",
    "Crime|Drama": "Crime Drama",
  };

  return fusionLabels[fusionKey] ?? `${firstTwo[0]}/${firstTwo[1]}`;
}

function enrichLessonWithWikiGenres(
  lesson: TutorLessonPayload,
  films: FilmInput[],
  wikiContext: Map<string, WikiFilmContext | null>,
  recommendationCtx: WikiFilmContext | null
): TutorLessonPayload {
  const filmNotes = lesson.filmNotes.map((note) => {
    const matchingFilm = films.find((f) => f.title.toLowerCase() === note.title.toLowerCase());
    const ctx = matchingFilm ? wikiContext.get(matchingFilm.title) : wikiContext.get(note.title);
    return {
      ...note,
      genreTag: deriveGenreTagFromWiki(ctx ?? null) ?? note.genreTag,
    };
  });

  return {
    ...lesson,
    filmNotes,
    recommendation: {
      ...lesson.recommendation,
      posterUrl:
        lesson.recommendation.posterUrl &&
        lesson.recommendation.posterUrl.trim().length > 0 &&
        !lesson.recommendation.posterUrl.includes("example.com")
          ? lesson.recommendation.posterUrl
          : (recommendationCtx?.thumbnailUrl ?? lesson.recommendation.posterUrl),
      filmUrl:
        lesson.recommendation.filmUrl &&
        lesson.recommendation.filmUrl.trim().length > 0 &&
        !lesson.recommendation.filmUrl.includes("example.com")
          ? lesson.recommendation.filmUrl
          : (recommendationCtx?.pageUrl ?? lesson.recommendation.filmUrl),
      genreTag: deriveGenreTagFromWiki(recommendationCtx) ?? lesson.recommendation.genreTag,
    },
  };
}

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
      let recommendationCtx: WikiFilmContext | null = null;
      const recommendationTitle = lesson.recommendation.title?.trim();
      if (recommendationTitle) {
        try {
          const recommendationMap = await fetchWikiContextForFilms([recommendationTitle]);
          recommendationCtx = recommendationMap.get(recommendationTitle) ?? null;
        } catch {
          recommendationCtx = null;
        }
      }

      const enrichedLesson = enrichLessonWithWikiGenres(lesson, films, wikiContext, recommendationCtx);

      return Response.json(
        {
          ok: true,
          generatedBy: "openai",
          mode,
          username: body.username,
          source_url: body.source_url,
          films,
          lesson: enrichedLesson,
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
      let fallbackRecommendationCtx: WikiFilmContext | null = null;
      const fallbackRecommendationTitle = fallbackLesson.recommendation.title?.trim();
      if (fallbackRecommendationTitle) {
        try {
          const recommendationMap = await fetchWikiContextForFilms([fallbackRecommendationTitle]);
          fallbackRecommendationCtx = recommendationMap.get(fallbackRecommendationTitle) ?? null;
        } catch {
          fallbackRecommendationCtx = null;
        }
      }

      const enrichedFallbackLesson = enrichLessonWithWikiGenres(
        fallbackLesson,
        films,
        wikiContext,
        fallbackRecommendationCtx
      );

      return Response.json(
        {
          ok: true,
          generatedBy: "fallback",
          mode,
          username: body.username,
          source_url: body.source_url,
          films,
          lesson: enrichedFallbackLesson,
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
