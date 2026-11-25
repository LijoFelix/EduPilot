# EduPilot – AI Smart Learning Assistant

EduPilot is a lightweight, context-aware education assistant designed to help students understand concepts, plan study time, practise, and improve through performance-based recommendations.

## Chosen vertical and target persona

- **Vertical:** Education
- **Persona:** A high-school, undergraduate, postgraduate, or independent learner who needs clear explanations, structured study time, and feedback about learning progress.
- **Problem:** Students often use the same learning materials and study plans regardless of their current understanding. They may not know which subject needs more attention or what to study next.

## Solution and approach

EduPilot combines a student profile, quiz history, a study planner, and a tutor interface. Its decision logic prioritizes subjects with lower recorded quiz averages, suggests revision when scores are low, and recommends advanced practice when scores are high.

### Main features

1. **Personalized student profile** – name, education level, subjects, daily study time, goal, and preferred explanation style.
2. **AI learning assistant** – a tutor endpoint that uses student context. It supports Gemini when an API key is configured and a clearly labelled demo response when no key is available.
3. **Smart study planner** – allocates study time across selected subjects and prioritizes subjects with lower recent quiz averages.
4. **Quiz result tracking** – records a subject, topic, and score; provides next-step guidance based on score bands.
5. **Performance insights** – shows average score, quiz count, and subject-wise results.

## How the decision engine works

- **Below 50%:** recommend revisiting fundamentals and simpler explanations.
- **50–79%:** recommend targeted practice on missed concepts.
- **80–100%:** recommend advanced practice or moving to the next topic.
- Study-plan generation sorts selected subjects by their recent quiz averages. Subjects without quiz history receive a neutral default priority.
- The generated plan uses the student's available daily study minutes.

These thresholds are configurable in `src/app.js` and are intended as transparent starter heuristics, not a formal assessment of ability.

## Technology

- Node.js 18+ (built-in HTTP server and Fetch API)
- HTML, CSS, and vanilla JavaScript
- JSON file persistence (no database installation required)
- Optional Gemini API integration

The project intentionally avoids large dependencies to keep the repository small and easy to run.

## Run locally

1. Install Node.js 18 or newer.
2. Clone this repository.
3. In the project directory, run:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000).

No `npm install` is required because the app uses Node.js built-in modules only.

## Enable Gemini AI (optional)

1. Copy `.env.example` to `.env`.
2. Add your Gemini API key to `GEMINI_API_KEY`.
3. Start the server with the environment variable available.

Example (PowerShell):

```powershell
$env:GEMINI_API_KEY="your-key"
npm start
```

Example (macOS/Linux):

```bash
GEMINI_API_KEY="your-key" npm start
```

Never commit `.env` or publish your API key. The key is read only by the backend. Without a key, the tutor provides a demo-mode learning response and the other modules remain usable.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/profile` | Read student profile |
| PUT | `/api/profile` | Update student profile |
| GET | `/api/dashboard` | Dashboard metrics and tasks |
| GET | `/api/quizzes` | Quiz history |
| POST | `/api/quizzes` | Save quiz score and get advice |
| POST | `/api/plan` | Generate a personalized study plan |
| PATCH | `/api/tasks/:id` | Toggle task completion |
| POST | `/api/chat` | Ask the learning assistant |

## Testing

Run:

```bash
npm test
```

The test suite checks the health endpoint, profile validation, quiz feedback, and study-plan prioritization.

## Assumptions and limitations

- This is a student-focused prototype, not a replacement for teachers or verified course materials.
- Quiz scores are entered by the learner; the current version does not yet include an automated question bank or proctored assessment.
- The included JSON store is suitable for a small local demonstration. A production deployment should use a managed database, authentication, rate limiting, and secure user isolation.
- Gemini is optional. AI availability depends on a valid API key, provider access, and network connectivity.
- Do not enter personal, confidential, or sensitive information into the demo.

## Security and accessibility

- API keys are never placed in frontend code.
- Request payloads and user-entered strings have basic validation and length limits.
- Static file paths are restricted to the public directory.
- The interface uses semantic forms, labels, keyboard-operable buttons, responsive layouts, and status messaging.

## Repository hygiene

Keep the repository public, use only the `main` branch, and do not commit `.env`, `node_modules`, or generated build output.
