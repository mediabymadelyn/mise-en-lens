# Mise-en-lens
A personalized AI system that helps users understand film through their Letterboxd-style Top 4, combining film theory with interactive, taste-based learning.

## Prerequisites

- Node.js >= 20.9.0 (recommended: install via [nvm](https://github.com/nvm-sh/nvm))
- npm

## Local setup

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment variables

Create a `.env.local` file in the project root:

```
OPENAI_API_KEY=sk-...
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | — | OpenAI API key for AI-generated lessons and quizzes. Without it, the app falls back to a built-in lesson generator. |
| `OPENAI_FILM_TUTOR_MODEL` | No | `gpt-4o-mini` | Override the OpenAI model used for tutor generation. |
