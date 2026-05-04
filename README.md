# Mise-en-lens

Mise-en-lens is a personalized AI film tutor that turns a user's Letterboxd-style Top 4 into a guided lesson and quiz. It combines film analysis, Wikipedia grounding, and interactive feedback to help users move from recognition to interpretation, comparison, and transfer.

## What It Does

- Imports a user's Top 4 from Letterboxd or manual entry
- Generates a short lesson/blurb grounded in Wikipedia context
- Runs a 9-question quiz with warm-up, interpretation, compare, transfer, and reflection sections
- Falls back to deterministic content when API calls fail

## Tech Stack

- Next.js App Router
- TypeScript
- OpenAI API for lesson and quiz generation
- Wikipedia API for film grounding
- Letterboxd scraping with a manual-entry fallback

## Getting Started

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` in the repo root before running the app.

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | - | OpenAI API key for AI-generated lessons and quizzes. Without it, the app falls back to a built-in generator. |
| `OPENAI_FILM_TUTOR_MODEL` | No | `gpt-4o-mini` | Model used for tutor generation. |
| `YOUTUBE_API_KEY` | No | - | Enables recap video links when a student does not remember a film. |

## Helpful Docs

- [Wikipedia integration architecture](docs/wikipedia-integration-architecture.md)
- [Prompt changelog](docs/prompt-changelog.md)
- [Test scenarios](docs/test-scenarios.md)
- [User testing notes](docs/user-testing-notes.md)
- [Productization plan](docs/productization-plan.md)

## Wikipedia Test Command

```bash
npx tsx scripts/test-wikipedia.ts "The Matrix"
```
