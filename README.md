# PolyTrack Exchange Mod

Adds a **Track Browser** (like TrackMania Exchange) and **Campaign System** to PolyTrack.

## Features
- 🏎️ Browse, search, and load community tracks in-game
- 📋 Browse and play campaigns (curated track sequences)
- ❤️ Like tracks and track your play history
- 📤 Upload your own tracks directly from the game
- ✅ Campaign progress tracked locally (per-track completion)

---

## Running the Backend

```bash
# Option A: Docker (recommended)
docker compose up -d

# Option B: Local Node.js
cd backend
npm install
npm start

# Option C: Dev mode (auto-restarts on changes, Node 18+)
cd backend
npm install
npm run dev
```

API runs at `http://localhost:8000`

---

## Installing the Mod (PML)

1. Install [PolyModLoader](https://github.com/polytrackmods/PolyModLoader)
2. Point PML to this repo's GitHub URL, OR copy the `mod/` folder into your PML mods directory
3. Make sure your backend is running
4. If your backend is deployed (not localhost), edit `API_BASE` in `mod/1.0.0/main.mod.js`

---

## In-Game Controls

| Shortcut | Action |
|---|---|
| `Ctrl + E` | Open Track Browser |
| `Ctrl + R` | Open Campaign Browser |
| Menu buttons | Also injected into the main menu |

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/tracks` | List/search tracks |
| POST | `/tracks` | Upload a track |
| POST | `/tracks/{id}/like` | Like a track |
| POST | `/tracks/{id}/play` | Record a play |
| GET | `/campaigns` | List campaigns |
| GET | `/campaigns/{id}` | Get campaign + full track data |
| POST | `/campaigns` | Create a campaign |

Full docs: `http://localhost:8000/docs`

---

## Creating a Campaign (API)

First upload your tracks to get their IDs, then:

```bash
curl -X POST http://localhost:8000/campaigns \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Beginner Series",
    "author": "you",
    "description": "5 beginner-friendly tracks",
    "track_ids": ["abc12345", "def67890"]
  }'
```

---

## File Structure

```
polytrack-exchange-mod/
├── latest.json              ← PML version map
├── docker-compose.yml
├── backend/
│   ├── main.py              ← FastAPI server
│   ├── requirements.txt
│   └── Dockerfile
└── mod/
    └── 1.0.0/
        ├── manifest.json
        └── main.mod.js      ← All UI + mod logic
```
