# Wikipedia Integration Architecture

## Overview

Wikipedia article content (intro, plot synopsis, and thematic analysis) is fetched for each of a user's Top 4 Letterboxd films and injected into the tutoring pipeline to ground lessons and quizzes in verifiable facts.

## Data Flow

```
┌─────────────┐
│   Browser    │
│  (page.tsx   │
│  quiz/page)  │
└──────┬───────┘
       │ POST /api/letterboxd/top4
       ▼
┌──────────────────┐
│ Letterboxd       │     ┌──────────────────────────────────┐
│ Scraper          │────▶│ LetterboxdFilm[]                 │
│ (scraper.ts)     │     │ { title, film_url, poster_url }  │
└──────────────────┘     └───────────────┬──────────────────┘
                                         │
       ┌─────────────────────────────────┘
       │ POST /api/tutor  (with films + mode)
       ▼
┌──────────────────────────────────────────────────────────┐
│                  Tutor API Route                         │
│                  (app/api/tutor/route.ts)                │
│                                                          │
│  1. Validate request                                     │
│  2. Fetch Wikipedia context ◄────────────────────┐       │
│  3. Generate lesson or quiz                      │       │
│     ├── OpenAI path  (with wiki context)         │       │
│     └── Fallback path (with wiki context)        │       │
└──────────────────────────────────────────────────┼───────┘
                                                   │
                          ┌────────────────────────┘
                          ▼
          ┌──────────────────────────────┐
          │  Wikipedia Client            │
          │  (lib/wikipedia/client.ts)   │
          │                              │
          │  For each film title:        │
          │  ┌────────────────────────┐  │
          │  │ 1. Search Wikipedia    │  │
          │  │    "Title (film)"      │  │
          │  │    fallback: "Title"   │  │
          │  │                        │  │
          │  │ 2. Fetch summary       │  │
          │  │    (REST API)          │  │
          │  │    → extract           │  │
          │  │    → description       │  │
          │  │                        │  │
          │  │ 3. Fetch sections list │  │
          │  │    (Action API)        │  │
          │  │    → find Plot index   │  │
          │  │    → find Themes index │  │
          │  │                        │  │
          │  │ 4. Fetch section text  │  │
          │  │    → plot (≤500 words) │  │
          │  │    → themes (≤500 w)   │  │
          │  └────────────────────────┘  │
          │                              │
          │  All 4 films in parallel     │
          │  5s timeout per film         │
          │  Failures return null        │
          │                              │
          │  Returns:                    │
          │  Map<title, WikiFilmContext>  │
          └──────────────┬───────────────┘
                         │
          ┌──────────────┴───────────────┐
          ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│  OpenAI Path     │          │  Fallback Path       │
│  (openai.ts)     │          │  (fallback.ts)       │
│                  │          │                      │
│  Prompt gets:    │          │  Lesson:             │
│  • extract       │          │  • Film note summary │
│  • plot synopsis │          │    uses plot text     │
│  • themes        │          │    instead of generic │
│                  │          │    boilerplate        │
│  Instructs LLM:  │          │                      │
│  • Ground facts  │          │  Quiz:               │
│    in reference  │          │  • Extracts proper   │
│    context       │          │    nouns + film vocab │
│  • Use real      │          │    from extract,     │
│    details for   │          │    plot, and themes  │
│    acceptable    │          │  • Appends to each   │
│    answers       │          │    question's        │
│                  │          │    acceptableAnswers  │
│                  │          │    and acceptable-    │
│                  │          │    Keywords arrays    │
└────────┬─────────┘          └──────────┬───────────┘
         │                               │
         └───────────────┬───────────────┘
                         ▼
          ┌──────────────────────────────┐
          │  Quiz Answer Verification    │
          │  (app/quiz/page.tsx)         │
          │                              │
          │  evaluateShortAnswer()       │
          │  • No code changes needed    │
          │  • Checks acceptableAnswers  │
          │    and acceptableKeywords    │
          │  • Automatically benefits    │
          │    from richer arrays        │
          └──────────────────────────────┘
```

## WikiFilmContext Type

```typescript
type WikiFilmContext = {
  filmTitle: string;       // Original Letterboxd title
  wikiTitle: string;       // Wikipedia article title
  extract: string;         // Intro paragraph (overview, cast, director)
  description: string;     // One-line Wikidata description (e.g. "1999 film by the Wachowskis")
  pageUrl: string;         // Full Wikipedia URL
  plot: string | null;     // Plot synopsis section (≤500 words)
  themes: string | null;   // Themes/Thematic analysis section (≤500 words)
};
```

## Wikipedia API Calls Per Film

| Step | API | Endpoint | Purpose |
|------|-----|----------|---------|
| Search | Action API | `action=query&list=search` | Find article title from film name |
| Summary | REST API | `/page/summary/{title}` | Get intro extract + description |
| Sections | Action API | `action=parse&prop=sections` | Get section index list |
| Plot text | Action API | `action=parse&prop=wikitext&section=N` | Get Plot section as wikitext |
| Themes text | Action API | `action=parse&prop=wikitext&section=N` | Get Themes section as wikitext |

Wikitext markup is stripped to plain text before use.

## Error Handling

```
Per-film level:     try/catch around each film → returns null on failure
Timeout:            Promise.race with 5s deadline per film
Batch level:        Promise.allSettled across all 4 films
Route level:        try/catch around fetchWikiContextForFilms → empty Map on failure
Prompt level:       Films with null context are simply omitted from reference block
```

No failure at any level prevents the tutor from generating output.

## Prompt Size Budget

Per film: ~75 words (extract) + ~500 words (plot) + ~500 words (themes) = ~1,075 words

For 4 films: ~4,300 words of reference context + ~200 words of prompt instructions = ~4,500 words total (~6,000 tokens). Well within gpt-4o-mini's 128K context window.
