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

  const summary = wikiCtx?.extract
    ? `${wikiCtx.extract.split(". ").slice(0, 2).join(". ")}. This makes it a useful reference point for studying how film style shapes interpretation.`
    : defaultSummary;

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
  const first = films[0]?.title ?? "one of your favorites";
  const second = films[1]?.title ?? "another film in your Top 4";
  const third = films[2]?.title ?? "a third favorite";
  const fourth = films[3]?.title ?? "a fourth favorite";

  return [
    {
      id: "q1",
      questionType: "multiple_choice",
      prompt: `To understand how ${first} creates its mood, which element would you notice first?`,
      focus: archetype.conceptName,
      hint: "Look for something you can see or hear on screen.",
      explanation:
        "Film creates feeling through visible and audible choices. Starting there gives you concrete evidence.",
      options: [
        "How the camera frames characters and spaces",
        "The color of lighting in key scenes",
        "The sound design and silence",
        "The costumes and props chosen",
      ],
      correctAnswer: "How the camera frames characters and spaces",
      correctFeedback:
        "Yes, exactly. Framing is one of the most direct ways to guide what the viewer feels.",
      partialFeedback:
        "You're on the right track. These are all techniques, but framing—how the camera positions characters—is the fastest entry point.",
      incorrectFeedback:
        "Not quite. Pick one of the visible or audible techniques—something you can actually see or hear on screen.",
    },
    {
      id: "q2",
      questionType: "multiple_choice",
      prompt: `What best describes how ${second} makes you feel during tense moments?`,
      focus: "Recognition",
      hint: "Look at how the film uses specific techniques, not just what happens in the plot.",
      explanation: "Understanding tone means noticing how style choices create emotion, not just following plot events.",
      options: [
        "Close-ups and silence make you focus on character fear or doubt",
        "Quick editing and bright lighting create energy and excitement",
        "Wide shots and ambient sound keep the scene feeling distant or isolated",
        "Slow pacing with music makes moments feel reflective or sad",
      ],
      correctAnswer: "Close-ups and silence make you focus on character fear or doubt",
      correctFeedback:
        "Correct. You identified a specific technique (close-ups and silence) and its emotional effect.",
      partialFeedback:
        "You're on the right track, but these all describe real techniques. Pick the one that matches ${second}'s tone best.",
      incorrectFeedback:
        "Not quite. Think about whether ${second} uses close or wide shots, and whether it's quiet or busy with sound.",
    },
    {
      id: "q3",
      questionType: "short_answer",
      prompt: `In one sentence max, what is one big theme or concern ${third} explores? (Examples: identity, power, family, memory, belonging)`,
      focus: "Societal context",
      hint: "Name one theme, then briefly say why the film cares about it.",
      explanation:
        "Theme is just the big idea a film keeps returning to. One clear idea is enough.",
      maxWords: 18,
      placeholder: "Example: It explores identity by showing characters trying to find where they belong.",
      acceptableAnswers: [
        "identity",
        "power",
        "family",
        "technology",
        "class",
        "memory",
        "gender",
        "violence",
        "belonging",
        "loss",
      ],
      acceptableKeywords: [
        "identity",
        "power",
        "family",
        "technology",
        "class",
        "gender",
        "memory",
        "belonging",
        "explores",
        "shows",
      ],
      correctFeedback:
        "Yes, exactly. You named a theme and connected it to the film.",
      partialFeedback:
        "You're on the right track. Add the theme word more directly (identity, power, family, etc.).",
      incorrectFeedback:
        "Not quite. Pick one theme word from the examples, then add one sentence about why the film cares about it.",
    },
    {
      id: "q4",
      questionType: "short_answer",
      prompt: `Pick one specific moment in ${first} and explain what ${archetype.conceptName.toLowerCase()} creates there in one sentence.`,
      focus: archetype.conceptName,
      hint: "Name one choice (like lighting or framing) and what feeling it creates.",
      explanation:
        "This anchors the concept to something real you saw, not abstract theory.",
      maxWords: 18,
      placeholder: "The close-up on the character's face shows doubt and hesitation.",
      acceptableAnswers: archetype.conceptName
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean),
      acceptableKeywords: [
        ...archetype.conceptName
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter(Boolean),
        "close-up",
        "lighting",
        "silence",
        "sound",
        "color",
        "framing",
        "editing",
        "moment",
      ],
      correctFeedback:
        "Correct. You grounded the concept in a specific choice and feeling.",
      partialFeedback:
        "You're on the right track. Name one specific film technique and what it helps the viewer notice or feel.",
      incorrectFeedback:
        "Not quite. Point to one specific choice on screen (like lighting, framing, or sound) and say what it creates.",
    },
    {
      id: "q5",
      questionType: "short_answer",
      prompt: `In one sentence, name one technique ${second} uses and explain what it makes you pay attention to.`,
      focus: "Guided interpretation",
      hint: "Example: 'Close-ups make me focus on the character's expression.'",
      explanation: "Technique and effect—that's all you need for a reading.",
      maxWords: 16,
      placeholder: "Close-ups on the character's face make me focus on their doubt.",
      acceptableAnswers: ["close-up", "silence", "color", "pacing", "framing", "sound", "editing", "lighting"],
      acceptableKeywords: ["close-up", "silence", "color", "pacing", "framing", "sound", "focus", "attention", "watch", "notice"],
      correctFeedback:
        "Yes, exactly. You named a technique and what it makes the viewer notice.",
      partialFeedback:
        "You're close. Make sure you name the specific technique (like close-up or silence) and what it creates.",
      incorrectFeedback:
        "Not quite. Try: '[Technique] makes me notice [what you pay attention to].'",
    },
    {
      id: "q6",
      questionType: "multiple_choice",
      prompt: `Now apply what you learned from ${first}: in ${fourth}, what would you look for to understand its mood?`,
      focus: "Transfer",
      hint: "You know how to read one film. What would help you read another?",
      explanation: "Transfer is just using skills you already have on a new film.",
      options: [
        "How lighting and framing create atmosphere and focus",
        "The director's complete filmography and career history",
        "A detailed plot summary from start to finish",
        "The actor's background and other roles they've played",
      ],
      correctAnswer: "How lighting and framing create atmosphere and focus",
      correctFeedback:
        "Yes, exactly. You're applying the same reading skills to a new film.",
      partialFeedback:
        "You're on the right track. Focus on the techniques (like lighting and framing) that you used to understand the first film.",
      incorrectFeedback:
        "Not quite. Think about what helped you understand ${first}'s mood. That same thing works for any film.",
    },
    {
      id: "q7",
      questionType: "short_answer",
      prompt: `Name one way ${archetype.conceptName} shows up in ${second}, just like it did in ${first}.`,
      focus: "Transfer",
      hint: "Name one technique in ${second} and how it's similar to ${first}.",
      explanation: "Transfer means noticing the same pattern in a different film.",
      maxWords: 18,
      placeholder: "Both use close-ups and silence to show the character's doubt.",
      acceptableAnswers: archetype.conceptName
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean),
      acceptableKeywords: [
        ...archetype.conceptName
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter(Boolean),
        "both",
        "same",
        "similar",
        "close-up",
        "silence",
        "sound",
        "framing",
        "color",
      ],
      correctFeedback:
        "Correct. You found the pattern in both films.",
      partialFeedback:
        "You're on the right track. Name the technique and say how both films use it similarly.",
      incorrectFeedback:
        "Not quite. Mention one technique that appears in both films the same way.",
    },
    {
      id: "q8",
      questionType: "short_answer",
      prompt: "In one sentence, name one technique or choice you will actively look for next time you watch a film.",
      focus: "Reflection",
      hint: "Be specific: lighting, framing, sound, editing, composition, or blocking.",
      explanation: "The goal is to turn learning into a real viewing habit you can repeat.",
      maxWords: 14,
      placeholder: "I will look for how close-ups and silence show character doubt.",
      acceptableAnswers: ["framing", "close-up", "color", "sound", "silence", "pacing", "editing", "blocking", "look for", "track"],
      acceptableKeywords: ["look for", "track", "notice", "watch", "pay attention", "framing", "close-up", "color", "sound", "silence"],
      correctFeedback:
        "Correct. That's a concrete habit you can use in any film.",
      partialFeedback:
        "You're close. Name one specific technique clearly (like framing, sound, or color).",
      incorrectFeedback:
        "Not quite. Start with 'I will look for' and name one technique you saw in this quiz.",
    },
  ];
}

const FILM_KEYWORDS = new Set([
  "cinematography", "noir", "expressionism", "surrealism", "realism",
  "neorealism", "montage", "suspense", "thriller", "dystopia", "satire",
  "allegory", "symbolism", "minimalism", "postmodern", "avant-garde",
  "documentary", "narrative", "protagonist", "antagonist", "soundtrack",
]);

function extractWikiKeywords(extract: string): string[] {
  const words = extract.split(/[\s,;:.!?()\[\]"]+/).filter(Boolean);
  const keywords = new Set<string>();

  for (const word of words) {
    const lower = word.toLowerCase();
    if (FILM_KEYWORDS.has(lower)) {
      keywords.add(lower);
      continue;
    }
    if (word.length >= 3 && word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
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
    if (ctx) {
      allWikiKeywords.push(...extractWikiKeywords(ctx.extract));
    }
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
      "Eight quick prompts: easy recognition first, then guided interpretation, then transfer and reflection. Keep each short answer to one sentence.",
    transferConcept: {
      concept: archetype.conceptName,
      fromFilm,
      applyToFilm,
      explanation: `${archetype.conceptName} means noticing how a craft choice shapes meaning in ${fromFilm}. Use that same lens when reading ${applyToFilm}.`,
    },
    questions,
  };
}
