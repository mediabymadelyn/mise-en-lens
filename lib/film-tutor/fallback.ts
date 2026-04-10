import type { LetterboxdFilm } from "@/lib/letterboxd/scraper";
import type { QuizQuestion, TutorLessonPayload, TutorQuizPayload } from "@/lib/film-tutor/types";

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

function buildFilmNote(film: LetterboxdFilm, index: number, archetype: TasteArchetype) {
  return {
    title: film.title,
    summary:
      index === 0
        ? `This pick likely acts as a cornerstone for your taste, which makes it a useful starting point for discussing how film style shapes interpretation.`
        : `This selection reinforces the pattern in your Top 4 by adding another example of how mood, genre, and point of view can teach us to read movies more closely.`,
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
  const third = films[2]?.title ?? "your list";

  return [
    {
      id: "q1",
      questionType: "multiple_choice",
      prompt: `Which part of ${first} would you most likely study first if you wanted to talk about how the film creates feeling?`,
      focus: archetype.conceptName,
      hint: "Choose the answer that points to a film technique, not just plot recap.",
      explanation:
        "Film analysis usually starts with a visible or audible craft choice because that gives you something concrete to interpret.",
      options: [
        "A camera, sound, or color choice",
        "Every plot twist in order",
        "The full ending explained",
        "A complete character biography",
      ],
      correctAnswer: "A camera, sound, or color choice",
      correctFeedback:
        "Exactly. Recognizing a formal choice is the fastest way into film analysis.",
      partialFeedback:
        "You are close, but the best starting point is usually a concrete craft choice like framing, sound, or color.",
      incorrectFeedback:
        "Try looking for a craft decision rather than retelling the story. Film analysis becomes easier when you begin with something the movie is doing on screen or in sound.",
    },
    {
      id: "q2",
      questionType: "short_answer",
      prompt: `In one short sentence, what bigger issue could ${second} connect to: identity, power, family, technology, or something similar?`,
      focus: "Societal context",
      hint: "Keep it short. Name one issue and, if you can, connect it to a scene, mood, or recurring image.",
      explanation:
        "A good answer does not need to be perfect. It just needs to connect the film to one larger cultural concern.",
      maxWords: 18,
      placeholder: "Example: It could connect to identity and how the film shows people trying to belong.",
      acceptableAnswers: [
        "identity",
        "power",
        "family",
        "technology",
        "class",
        "memory",
        "gender",
        "violence",
      ],
      acceptableKeywords: [
        "society",
        "culture",
        "identity",
        "power",
        "class",
        "gender",
        "family",
        "technology",
      ],
      correctFeedback:
        "Nice. That kind of short connection is enough to start building media-literacy habits.",
      partialFeedback:
        "You are moving in the right direction. Try naming the bigger issue a little more directly.",
      incorrectFeedback:
        "A helpful next try is to name one big issue, like identity or power, instead of summarizing the plot.",
    },
    {
      id: "q3",
      questionType: "short_answer",
      prompt: `Using ${third}, finish this idea in one sentence: "${archetype.conceptName} matters because..."`,
      focus: archetype.conceptName,
      hint: "Use plain language. You only need one short reason and one small example.",
      explanation:
        "This final step is about transfer: using a film you know to explain why a film-studies idea is useful.",
      maxWords: 20,
      placeholder: "Example: ...because it helps explain how the movie's look shapes the mood.",
      acceptableAnswers: archetype.conceptName
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean),
      acceptableKeywords: [
        ...archetype.conceptName
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter(Boolean),
        "mood",
        "feeling",
        "style",
        "camera",
        "sound",
        "color",
      ],
      correctFeedback:
        "That works well. You connected a concept to a concrete effect, which is exactly the skill this quiz is practicing.",
      partialFeedback:
        "The idea is coming through. Tighten it by naming what the concept helps you notice in the film.",
      incorrectFeedback:
        "Try one short reason the concept matters, then point to a visual or sound choice in the film.",
    },
  ];
}

export function buildFallbackLesson(films: LetterboxdFilm[]): TutorLessonPayload {
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
    filmNotes: films.map((film, index) => buildFilmNote(film, index, archetype)),
    recommendation: {
      title: archetype.recommendation.title,
      whyYouMightLikeIt: archetype.recommendation.why,
      educationalRedirect: archetype.recommendation.redirect,
    },
  };
}

export function buildFallbackQuiz(films: LetterboxdFilm[]): TutorQuizPayload {
  const archetype = detectArchetype(films.map((film) => film.title));

  return {
    title: "Practice with your Top 4",
    intro:
      "This short quiz is designed to be quick. Start by recognizing a film choice, then make one short interpretation, then finish with a brief transfer idea.",
    questions: buildQuizQuestions(films, archetype),
  };
}
