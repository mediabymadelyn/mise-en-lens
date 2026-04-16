import type { LetterboxdFilm } from "@/lib/letterboxd/scraper";
import type { QuizQuestion, TutorLessonPayload, TutorQuizPayload } from "@/lib/film-tutor/types";
import type { WikiFilmContext } from "@/lib/wikipedia/client";

const TITLE_KEYWORDS = {
  animation: ["spirited", "totoro", "animated", "spider-verse", "shrek", "coraline", "fantastic mr"],
  horror: ["horror", "scream", "hereditary", "midsommar", "get out", "alien", "pearl", "possession"],
  romance: ["before", "love", "moonlight", "portrait", "in the mood", "past lives", "la la land"],
  sciFi: ["2001", "blade runner", "matrix", "interstellar", "arrival", "akira", "children of men"],
  crime: ["godfather", "goodfellas", "heat", "zodiac", "memories of murder", "taxi driver", "se7en"],
};

type TasteArchetype = {
  key: "animation" | "horror" | "romance" | "sciFi" | "crime" | "general";
  conceptName: string;
  conceptExplanation: string;
  conceptConnection: string;
  recommendation: {
    title: string;
    why: string;
    redirect: string;
  };
};

const ARCHETYPES: Record<TasteArchetype["key"], TasteArchetype> = {
  animation: {
    key: "animation",
    conceptName: "Color and visual storytelling",
    conceptExplanation:
      "In animation, color, shape, and movement often do the work that live-action films hand to realism. Tracking how a scene uses palette, rhythm, and framing is a beginner-friendly way to study film form.",
    conceptConnection:
      "Your Top 4 suggests you respond strongly to films where style is not decoration, but the language that carries emotion and theme.",
    recommendation: {
      title: "The Red Turtle",
      why: "It is visually expressive, emotionally accessible, and ideal for noticing how composition and movement can carry meaning.",
      redirect:
        "It gently shifts the lesson toward minimalist visual storytelling, so the recommendation feels educational instead of just adjacent.",
    },
  },
  horror: {
    key: "horror",
    conceptName: "Tension through sound and framing",
    conceptExplanation:
      "Horror teaches one of the clearest film-theory lessons: what the camera hides, delays, or isolates can be as important as what it shows. Sound design, pacing, and negative space guide audience emotion moment by moment.",
    conceptConnection:
      "These selections point toward an interest in mood, dread, and films that use formal choices to shape psychological response.",
    recommendation: {
      title: "Cure",
      why: "It extends the same tension-building habits into a quieter, more analytical style of suspense.",
      redirect:
        "That makes it a strong bridge from enjoying horror to studying atmosphere, ambiguity, and visual restraint.",
    },
  },
  romance: {
    key: "romance",
    conceptName: "Performance, blocking, and emotional point of view",
    conceptExplanation:
      "Character-focused films often teach how performances are shaped by framing, body language, and where people are placed within a scene. Blocking can reveal power, intimacy, hesitation, or emotional distance.",
    conceptConnection:
      "Your favorites suggest that emotional texture and relational nuance matter as much as plot.",
    recommendation: {
      title: "Brief Encounter",
      why: "It is approachable, emotionally rich, and perfect for studying how restraint and staging create feeling.",
      redirect:
        "The film broadens the conversation from contemporary taste into the history of screen romance and classical visual storytelling.",
    },
  },
  sciFi: {
    key: "sciFi",
    conceptName: "World-building through production design",
    conceptExplanation:
      "Science fiction often makes film form easier to notice because every object, space, and texture is deliberately built. Production design, cinematography, and sound help a world feel believable before the story explains it.",
    conceptConnection:
      "Your Top 4 leans toward films where ideas and image-making work together, not separately.",
    recommendation: {
      title: "Gattaca",
      why: "It is a clean, accessible example of how design choices can express theme without overwhelming the viewer.",
      redirect:
        "That makes it useful for connecting speculative storytelling to questions of identity, social control, and visual symbolism.",
    },
  },
  crime: {
    key: "crime",
    conceptName: "Editing, perspective, and moral framing",
    conceptExplanation:
      "Crime and thriller films often teach how editing and point of view shape judgment. The order of shots, who gets close-ups, and when information is withheld all influence how viewers interpret guilt, power, or sympathy.",
    conceptConnection:
      "Your picks suggest an interest in films that balance tension with character study and ethical ambiguity.",
    recommendation: {
      title: "Le Samourai",
      why: "It strips the genre down to image, rhythm, and behavior, which makes its formal choices especially easy to study.",
      redirect:
        "That helps redirect taste from plot momentum toward style, silence, and cinematic minimalism.",
    },
  },
  general: {
    key: "general",
    conceptName: "Mise-en-scene",
    conceptExplanation:
      "Mise-en-scene is the study of everything placed in front of the camera: lighting, costumes, actors, props, and composition. It is one of the most useful beginner concepts because it turns film-watching into close observation.",
    conceptConnection:
      "Even with a mixed Top 4, your selections still reveal a taste for movies that feel intentional in mood, design, and point of view.",
    recommendation: {
      title: "Do the Right Thing",
      why: "It is vivid, accessible, and full of clear visual choices that connect style to social meaning.",
      redirect:
        "That makes it a strong next step for learning how form, community, and historical context can work together.",
    },
  },
};

function detectArchetype(titles: string[]): TasteArchetype {
  const lowered = titles.map((title) => title.toLowerCase());
  const matches = Object.entries(TITLE_KEYWORDS).map(([key, words]) => ({
    key: key as TasteArchetype["key"],
    count: words.reduce(
      (total, word) => total + (lowered.some((title) => title.includes(word)) ? 1 : 0),
      0
    ),
  }));

  const winner = matches.sort((a, b) => b.count - a.count)[0];
  if (!winner || winner.count === 0) {
    return ARCHETYPES.general;
  }

  return ARCHETYPES[winner.key];
}

function buildFilmNote(
  film: LetterboxdFilm,
  index: number,
  archetype: TasteArchetype,
  wikiCtx?: WikiFilmContext | null
) {
  const defaultSummary =
    index === 0
      ? `This pick likely acts as a cornerstone for your taste, which makes it a useful starting point for discussing how film style shapes interpretation.`
      : `This selection reinforces the pattern in your Top 4 by adding another example of how mood, genre, and point of view can teach us to read movies more closely.`;

  let summary = defaultSummary;
  if (wikiCtx?.plot) {
    summary = `${wikiCtx.plot.split(". ").slice(0, 3).join(". ")}. This makes it a useful reference point for studying how film style shapes interpretation.`;
  } else if (wikiCtx?.extract) {
    summary = `${wikiCtx.extract.split(". ").slice(0, 2).join(". ")}. This makes it a useful reference point for studying how film style shapes interpretation.`;
  }

  return {
    title: film.title,
    summary,
    artisticElements:
      archetype.key === "animation"
        ? "Pay attention to palette, movement, and how the frame guides your eye before any dialogue explains what matters."
        : archetype.key === "horror"
          ? "Notice how framing, off-screen space, and sound cues build tension even before a scene delivers a payoff."
          : archetype.key === "romance"
            ? "Watch how performance, blocking, and camera distance communicate intimacy or emotional hesitation."
            : archetype.key === "sciFi"
              ? "Production design, lighting, and world-building details are especially important here because they carry thematic meaning."
              : archetype.key === "crime"
                ? "Editing rhythm, selective information, and shifting perspective can change how you judge characters."
                : "Look at the film through mise-en-scene: setting, color, performance, and camera placement all contribute to interpretation.",
    societalContext:
      "A useful next step is to ask what broader anxieties, values, or cultural conversations this film reflects, and how its style helps deliver that perspective to the viewer.",
  };
}

function buildQuizQuestions(films: LetterboxdFilm[], archetype: TasteArchetype): QuizQuestion[] {
  const filmA = films[0]?.title ?? "one of your favorites";
  const filmB = films[1]?.title ?? "another film in your Top 4";
  const filmC = films[2]?.title ?? "a third favorite";

  return [
    // Q1 — Recognition, multiple choice: easy fact from filmA
    {
      id: "q1",
      questionType: "multiple_choice",
      prompt: `What best describes the genre or style of ${filmA}?`,
      focus: "Recognition",
      hint: "Think about how the film feels overall — its genre or the type of story it tells.",
      explanation: "Recognizing genre helps you know what visual and narrative tools to expect.",
      options: [
        archetype.key === "animation"
          ? "Animated feature with an emotional, visually expressive story"
          : archetype.key === "horror"
            ? "A horror film that uses atmosphere and tension over jump scares"
            : archetype.key === "romance"
              ? "A romantic drama focused on emotional relationships and intimacy"
              : archetype.key === "sciFi"
                ? "A science-fiction film exploring ideas through visual world-building"
                : archetype.key === "crime"
                  ? "A crime or thriller film with moral ambiguity and tension"
                  : "A drama with a strong point of view and intentional visual style",
        "A fast-paced action blockbuster with big set pieces",
        "A documentary focused on historical events",
        "A comedy built around improvised dialogue",
      ],
      correctAnswer:
        archetype.key === "animation"
          ? "Animated feature with an emotional, visually expressive story"
          : archetype.key === "horror"
            ? "A horror film that uses atmosphere and tension over jump scares"
            : archetype.key === "romance"
              ? "A romantic drama focused on emotional relationships and intimacy"
              : archetype.key === "sciFi"
                ? "A science-fiction film exploring ideas through visual world-building"
                : archetype.key === "crime"
                  ? "A crime or thriller film with moral ambiguity and tension"
                  : "A drama with a strong point of view and intentional visual style",
      correctFeedback: "Correct. That's the genre foundation — now you can notice which techniques go with it.",
      partialFeedback: "Close. Look at the genre more broadly — what category of film does it belong to?",
      incorrectFeedback: "Not quite. Think about the overall type of story and how it makes you feel.",
    },
    // Q2 — Recognition, multiple choice: mood/tone of filmA
    {
      id: "q2",
      questionType: "multiple_choice",
      prompt: `Which of these best describes the mood or tone of ${filmA}?`,
      focus: "Recognition",
      hint: "Think about the feeling the film leaves you with — not the plot, the atmosphere.",
      explanation: "Identifying tone is a first step toward noticing which techniques create it.",
      options:
        archetype.key === "horror"
          ? [
              "Slow-building dread with unsettling silence and off-screen threat",
              "Playful and light, with upbeat music and bright visuals",
              "Epic and triumphant, building toward a hopeful ending",
              "Nostalgic and warm, focused on childhood memory",
            ]
          : archetype.key === "romance"
            ? [
                "Intimate and melancholic, with long pauses and restrained performance",
                "Loud and chaotic, driven by confrontation and action",
                "Satirical and comedic, mocking its own genre conventions",
                "Urgent and thriller-like, with fast cuts and rising stakes",
              ]
            : archetype.key === "sciFi"
              ? [
                  "Cold and contemplative, using visual design to express ideas",
                  "Warm and nostalgic, centered on family and belonging",
                  "Comedic and fast-paced, with slapstick and exaggeration",
                  "Romantic and emotional, driven by personal loss",
                ]
              : archetype.key === "crime"
                ? [
                    "Tense and morally ambiguous, with slow reveals and ethical weight",
                    "Optimistic and energetic, with clear heroes and villains",
                    "Dreamlike and surreal, ignoring narrative logic",
                    "Comedic and self-aware, playing with genre clichés",
                  ]
                : [
                    "Deliberate and atmospheric, rewarding close attention",
                    "Fast and surface-level, focused purely on entertainment",
                    "Chaotic and improvised, with no clear visual intent",
                    "Nostalgic and crowd-pleasing, avoiding difficult emotions",
                  ],
      correctAnswer:
        archetype.key === "horror"
          ? "Slow-building dread with unsettling silence and off-screen threat"
          : archetype.key === "romance"
            ? "Intimate and melancholic, with long pauses and restrained performance"
            : archetype.key === "sciFi"
              ? "Cold and contemplative, using visual design to express ideas"
              : archetype.key === "crime"
                ? "Tense and morally ambiguous, with slow reveals and ethical weight"
                : "Deliberate and atmospheric, rewarding close attention",
      correctFeedback: "Yes. You identified the tone — that's the starting point for reading technique.",
      partialFeedback: "You're in the right area. Think specifically about the atmosphere, not the story.",
      incorrectFeedback: `Not quite. Think about how ${filmA} makes you feel, not what happens in it.`,
    },
    // Q3 — Guided interpretation, short answer: theme in filmB
    {
      id: "q3",
      questionType: "short_answer",
      prompt: `Name one theme in ${filmB} and say why the film cares about it, in one sentence.`,
      focus: "Interpretation",
      hint: "A theme is a big idea the film keeps returning to — identity, power, family, memory, belonging.",
      explanation: "Theme is the film's subject. Naming it plus a reason shows you're reading beyond plot.",
      maxWords: 15,
      placeholder: "It explores identity because the characters spend the whole film searching for where they belong.",
      acceptableAnswers: [
        "identity", "power", "family", "memory", "belonging",
        "loss", "class", "gender", "violence", "freedom",
      ],
      acceptableKeywords: [
        "identity", "power", "family", "memory", "belonging",
        "loss", "explores", "shows", "cares", "returns",
      ],
      correctFeedback: "Good. You named a theme and connected it to the film's actual concern.",
      partialFeedback: "You named something real — now add why the film keeps coming back to it.",
      incorrectFeedback: "Not quite. Pick one theme word (identity, power, family) and say why the film cares about it.",
    },
    // Q4 — Guided interpretation, short answer: technique + feeling in filmC
    {
      id: "q4",
      questionType: "short_answer",
      prompt: `Pick one specific moment or technique in ${filmC} and say what feeling it creates, in one sentence.`,
      focus: "Interpretation",
      hint: "Name the technique (framing, sound, color, silence) and the emotion it produces.",
      explanation: "Connecting a specific technique to a feeling is the core of film analysis.",
      maxWords: 18,
      placeholder: "The long silence before the final scene creates a feeling of dread and inevitability.",
      acceptableAnswers: [
        "close-up", "silence", "color", "framing", "sound",
        "editing", "lighting", "pacing", "wide shot", "close shot",
      ],
      acceptableKeywords: [
        "close-up", "silence", "color", "framing", "sound",
        "creates", "feels", "makes", "produces", "builds",
      ],
      correctFeedback: "Exactly. Technique plus feeling — that's a film reading.",
      partialFeedback: "Close. Name the specific technique more clearly, then say what feeling it creates.",
      incorrectFeedback: "Not quite. Name one thing you see or hear on screen, then describe what feeling it creates.",
    },
    // Q5 — Transfer VERIFY (multiple choice) — placeholder, overwritten by buildFallbackQuiz with TransferSequence
    {
      id: "q5",
      questionType: "multiple_choice",
      prompt: `Which of these in ${filmA} is an example of using framing to create emotional focus?`,
      focus: "Transfer",
      hint: "Think about a moment where where the camera placed you affected what you felt.",
      explanation: "Recognizing a specific technique in context shows you can read film, not just describe it.",
      options: [
        "A tight close-up on a character's face during a moment of fear",
        "A wide establishing shot introducing a new location",
        "A cut to the next scene before the moment resolves",
        "Background music swelling during a speech",
      ],
      correctAnswer: "A tight close-up on a character's face during a moment of fear",
      correctFeedback: "Yes. That's framing creating emotional focus — the concept in action.",
      partialFeedback: "Close. Focus on what the framing does to your attention, not just what it shows.",
      incorrectFeedback: "Not quite. Think about what tight framing does to the viewer's focus and feeling.",
    },
    // Q6 — Transfer APPLY (short answer) — placeholder, overwritten by buildFallbackQuiz with TransferSequence
    {
      id: "q6",
      questionType: "short_answer",
      prompt: `Now find the same concept in ${filmB} — name one specific moment or technique, in one sentence.`,
      focus: "Transfer",
      hint: "Use the same lens you applied in Q5, but look at a different film.",
      explanation: "Transfer means taking a concept you learned and finding it somewhere new.",
      maxWords: 18,
      placeholder: "In ${filmB}, a close-up during the confrontation scene creates the same feeling of dread.",
      acceptableAnswers: [
        "close-up", "framing", "silence", "sound", "color",
        "lighting", "editing", "pacing", "moment", "technique",
      ],
      acceptableKeywords: [
        "close-up", "framing", "silence", "sound", "creates",
        "feels", "makes", "scene", "moment", "technique",
      ],
      correctFeedback: "Correct. You applied the concept to a new film — that's the transfer skill.",
      partialFeedback: "Close. Name the specific moment or technique in ${filmB} more clearly.",
      incorrectFeedback: "Not quite. Pick one specific moment in ${filmB} and say what technique is used and what it creates.",
    },
  ];
}

const FILM_KEYWORDS = new Set([
  "cinematography", "noir", "expressionism", "surrealism", "realism",
  "neorealism", "montage", "suspense", "thriller", "dystopia", "satire",
  "allegory", "symbolism", "minimalism", "postmodern", "avant-garde",
  "documentary", "narrative", "protagonist", "antagonist", "soundtrack",
]);

const STOP_WORDS = new Set([
  "the", "and", "for", "its", "his", "her", "was", "are", "has", "had",
  "but", "not", "this", "that", "with", "from", "into", "also", "been",
  "they", "their", "which", "when", "where", "who", "how", "all", "each",
  "she", "him", "them", "than", "then", "only", "very", "can", "will",
]);

function extractWikiKeywords(extract: string): string[] {
  const words = extract.split(/[\s,;:.!?()\[\]"]+/).filter(Boolean);
  const keywords = new Set<string>();

  for (const word of words) {
    const lower = word.toLowerCase();
    if (lower.length < 3 || STOP_WORDS.has(lower)) continue;

    if (FILM_KEYWORDS.has(lower)) {
      keywords.add(lower);
      continue;
    }
    if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
      keywords.add(lower);
    }
  }

  return [...keywords];
}

function enrichQuizKeywords(
  questions: QuizQuestion[],
  films: LetterboxdFilm[],
  wikiContext: Map<string, WikiFilmContext | null>
): QuizQuestion[] {
  const allWikiKeywords: string[] = [];
  for (const film of films) {
    const ctx = wikiContext.get(film.title);
    if (!ctx) continue;
    allWikiKeywords.push(...extractWikiKeywords(ctx.extract));
    if (ctx.plot) allWikiKeywords.push(...extractWikiKeywords(ctx.plot));
    if (ctx.themes) allWikiKeywords.push(...extractWikiKeywords(ctx.themes));
  }

  if (allWikiKeywords.length === 0) return questions;

  return questions.map((q) => {
    if (q.questionType !== "short_answer") return q;

    const existingAnswers = new Set(q.acceptableAnswers.map((a) => a.toLowerCase()));
    const existingKeywords = new Set(q.acceptableKeywords.map((k) => k.toLowerCase()));

    const newAnswers = allWikiKeywords
      .filter((kw) => !existingAnswers.has(kw))
      .slice(0, 6 - q.acceptableAnswers.length);
    const newKeywords = allWikiKeywords
      .filter((kw) => !existingKeywords.has(kw))
      .slice(0, 10 - q.acceptableKeywords.length);

    return {
      ...q,
      acceptableAnswers: [...q.acceptableAnswers, ...newAnswers],
      acceptableKeywords: [...q.acceptableKeywords, ...newKeywords],
    };
  });
}

export function buildFallbackLesson(
  films: LetterboxdFilm[],
  wikiContext?: Map<string, WikiFilmContext | null>
): TutorLessonPayload {
  const titles = films.map((film) => film.title);
  const archetype = detectArchetype(titles);
  const tasteProfile = [
    "You seem drawn to movies with a strong point of view rather than purely passive entertainment.",
    "Your Top 4 suggests you value atmosphere, style, and the feeling a film leaves behind.",
    "This mix is well-suited for learning film theory because the selections invite discussion about form as well as story.",
  ];

  return {
    headline: "Your Top 4 already functions like a film-studies syllabus.",
    overview:
      "Instead of treating favorite movies as isolated picks, Mise-en-Lens reads them as a pattern. The goal is to help you connect taste to craft, context, and transferable film-literacy skills.",
    tasteProfile,
    concept: {
      name: archetype.conceptName,
      explanation: archetype.conceptExplanation,
      connection: archetype.conceptConnection,
    },
    filmNotes: films.map((film, index) =>
      buildFilmNote(film, index, archetype, wikiContext?.get(film.title))
    ),
    recommendation: {
      title: archetype.recommendation.title,
      whyYouMightLikeIt: archetype.recommendation.why,
      educationalRedirect: archetype.recommendation.redirect,
    },
  };
}

export function buildFallbackQuiz(
  films: LetterboxdFilm[],
  wikiContext?: Map<string, WikiFilmContext | null>
): TutorQuizPayload {
  const archetype = detectArchetype(films.map((film) => film.title));
  const fromFilm = films[0]?.title ?? "your first favorite";
  const applyToFilm = films[2]?.title ?? "another film in your Top 4";

  const baseQuestions = buildQuizQuestions(films, archetype);
  const questions = wikiContext
    ? enrichQuizKeywords(baseQuestions, films, wikiContext)
    : baseQuestions;

  return {
    title: "Practice with your Top 4",
    intro:
      "Six prompts: two recognition questions, two interpretation questions, then a transfer sequence across two films. Keep each short answer to one sentence.",
    transferConcept: {
      concept: archetype.conceptName,
      fromFilm,
      applyToFilm,
      explanation: `${archetype.conceptName} means noticing how a craft choice shapes meaning in ${fromFilm}. Use that same lens when reading ${applyToFilm}.`,
    },
    questions,
  };
}
