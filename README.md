# Mise-en-lens

Mise-en-lens is a personalized AI film tutor that turns a user's Letterboxd-style Top 4 into a guided lesson and quiz. It combines film analysis, Wikipedia grounding, and interactive feedback to help users move from recognition to interpretation, comparison, and transfer.

## Project Description

The project is designed to help people learn film language by starting from movies they already know. It uses a lesson-then-quiz flow so users can first notice patterns in their taste, then practice interpretation, comparison, and transfer with structured support.

## Learning Theory Grounding

The quiz flow is based on scaffolded learning: students begin with easier recognition questions, then move into interpretation, comparison, and application. The design also uses retrieval practice and elaboration, since answering questions and explaining scenes in their own words helps strengthen memory and understanding. The final reflection step gives users a low-stakes way to think about what changed in their interpretation.

## Team Members

- Jenny Lee
- Madelyn Smith
- Denise Artiga

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

## Local Setup

1. Copy `.env.example` to `.env.local` in the repo root.
2. Add your `OPENAI_API_KEY` value.
3. Run `npm install`.
4. Start the app with `npm run dev`.

## Environment Variables

Copy `.env.example` to `.env.local` in the repo root before running the app.

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | - | OpenAI API key for AI-generated lessons and quizzes. Without it, the app falls back to a built-in generator. |
| `OPENAI_FILM_TUTOR_MODEL` | No | `gpt-4o-mini` | Model used for tutor generation. |
| `YOUTUBE_API_KEY` | No | - | Enables recap video links when a student does not remember a film. |

## AI Disclosure

This project was developed with assistance from Claude and Codex. Mise-en-Lens also uses AI to generate lesson and quiz content and to evaluate some student responses. If AI services are unavailable, it falls back to deterministic generated content so the app still works, with a less adaptive experience.

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
