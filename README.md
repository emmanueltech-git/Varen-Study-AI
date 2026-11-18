# Varen Study AI

An installable, offline-first Progressive Web App (PWA) with separate Community Health, Coding and Technology, and General Studies departments.

## Included
- Department and subject navigation
- Structured subject cards and progress indicators
- Filterable, randomised question bank with multiple-choice, true/false and short-answer questions
- Timed and untimed quizzes, scoring, explanations and performance history
- JSON question imports
- AI tutor server proxy with department and subject context
- Offline document retrieval for TXT, Markdown, CSV and PDF uploads
- Local notes, flashcards, study planner, backups and light/dark themes
- Service worker and web app manifest for installation

## Requirements
- Node.js 18 or newer
- Google Chrome or another modern browser

## Run locally
1. Extract the ZIP.
2. Open a terminal in the extracted `varen-study-ai` folder.
3. Run `npm start` (there are no external npm packages).
4. Open `http://localhost:3000` in Chrome.
5. For a syntax check, run `npm run check`.

The service worker and install prompt work on `localhost`. For installation on a phone over the internet, deploy the app to a host that provides HTTPS.

## Optional online AI
The app works without an AI key. To enable online AI, set these environment variables before starting the server:

- `AI_API_KEY` — secret API key from an AI provider compatible with the OpenAI Chat Completions API
- `AI_MODEL` — optional model name (default: `gpt-4.1-mini`)
- `AI_BASE_URL` — optional compatible API endpoint (default: OpenAI endpoint)
- `PORT` — optional server port (default: `3000`)

Example (PowerShell):
```powershell
$env:AI_API_KEY="YOUR_SECRET_KEY"
$env:AI_MODEL="gpt-4.1-mini"
npm start
```

Never place an API key in `public/app.js`, HTML, or any browser-side file. Do not publish your key or share it in chat. If online AI is not configured, the app automatically uses its offline helper.

## Question-bank import format
The Question Bank screen accepts a JSON array. Each entry should contain `department` (`chw`, `coding`, or `general`), `subject`, `topic`, `difficulty`, `type` (`mcq`, `truefalse`, or `short`), `question`, and `explanation`. MCQ entries also contain `options` and `correctIndex`. True/false entries contain `correctAnswer`. Short-answer entries contain `correctAnswer` and may contain `acceptedAnswers`.

## Important limitations
- The offline tutor uses a limited built-in explanation set and passage retrieval. It is not a full local language model.
- PDF extraction is best-effort text extraction and may miss scanned pages, images and complex layouts.
- The initial curated question bank contains 112 entries, not 100 entries for every subject. Additional questions can be imported through JSON.
- Notes and planner tasks are stored in the current browser's local storage. Clearing browser data can erase them; export/backup important notes.
- This is a study aid, not a medical reference or clinical decision tool. Confirm health information with course materials, instructors and qualified professionals.
- Online AI usage may incur provider charges. Have a parent/guardian or responsible adult review any account, billing and deployment arrangements.

## Deployment
Deploy the folder to a Node.js host with HTTPS. Configure the environment variables in the host's secret/environment settings. Do not expose the API key in client files. Static-only hosting can serve the PWA, but the online AI endpoint requires the included Node server or an equivalent secure backend.

## GitHub and Vercel deployment

This project uses a static PWA frontend in `public/` and Vercel serverless handlers in `api/`. The legacy `server.js` is for local Node.js hosting; Vercel uses the API handlers directly and does not run `server.js` as a persistent process.

### 1. Create and push the GitHub repository

```powershell
cd "C:\Users\user\Downloads\varen-study-ai\varen-study-ai"
git add .
git status
git commit -m "Prepare Varen Study AI for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Before committing, confirm `.env`, `.env.local` and provider keys are not staged. This repository includes `.env.example` but no real key.

### 2. Import the repository into Vercel

In the Vercel dashboard:

1. Choose **Add New → Project**.
2. Import the GitHub repository.
3. Leave Framework Preset as **Other**.
4. Build Command: `npm run build`
5. Output Directory: `public`
6. Install Command: `npm install`
7. Add server-side environment variables in **Project Settings → Environment Variables**:

| Variable | Required | Value |
|---|---|---|
| `AI_API_KEY` | No, to enable AI | Provider secret key |
| `AI_MODEL` | No | Provider model, default `gpt-4.1-mini` |
| `AI_BASE_URL` | No | Chat completions endpoint, default `https://api.openai.com/v1/chat/completions` |

Set `AI_API_KEY` separately for Production, Preview and Development environments if each should support AI. Never add the key to `NEXT_PUBLIC_*`, `VITE_*`, `public/`, HTML or Git.

Deploy the project. Vercel serves `public/` over HTTPS and maps `api/status.js`, `api/chat.js` and `api/documents.js` to `/api/status`, `/api/chat` and `/api/documents`.

### 3. Verify deployment

Open:

- `/` — application
- `/api/status` — should report whether online AI is configured
- `/manifest.webmanifest` — PWA manifest
- `/sw.js` — service worker

Without `AI_API_KEY`, `/api/chat` intentionally returns HTTP 503 and the frontend uses its offline helper. With a valid provider key, send a study question through the AI Tutor.

### 4. Redeploy after updates

```powershell
git add .
git commit -m "Update study platform"
git push
```

Vercel deploys each push automatically. Changing `public/sw.js` also changes the PWA cache version; the existing code uses a network-first SW strategy so application updates can replace cached assets.

## Persistent storage and privacy

- Questions are deployed with the PWA as static `public/questions.json` data.
- Notes, flashcards, tasks, chat history and performance data are stored in browser local storage.
- Uploaded document text is currently held in browser local storage and is not uploaded to a shared database.
- User accounts and cross-device cloud synchronization are not implemented.
- This avoids sending learner documents to the server and keeps uploaded content on the device. Clearing browser data removes local documents and progress.
"# Varen-Study-AI" 
