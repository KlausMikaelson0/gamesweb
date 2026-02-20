# Ultimate Social & Family Games Platform

Next.js + Tailwind + Socket.io implementation of a real-time multiplayer games hub.

## Implemented in this phase

- Netflix-style dashboard grouped by category:
  - Classic Cards
  - Speed & Trivia
  - Mystery & Roleplay
  - Game Builder Tools
- Room/Lobby system with:
  - Create Room (4-6 character room code)
  - Join Room
  - Shared player roster + host assignment
  - Live chat
- Game Builder Suite (local browser persistence prototype):
  - Jigsaw image upload module
  - Custom Quiz question module
  - Spin-the-Wheel text module
  - Personal Bingo phrase-to-card module
- First functional prototype game:
  - **Sketch & Guess** with synced canvas, guessing chat, turn/timer state, and scoring
- Mobile-first UI with Framer Motion transitions and synthesized win/loss sound effects.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS
- Socket.io (custom `server.js` runtime)
- Framer Motion
- Lucide React

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Notes

- Room and game state are currently in-memory (process-local) for rapid prototyping.
- To scale, move room state to a shared data layer (Redis/Postgres) and back the builder suite with persistence.
