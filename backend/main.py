from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import sqlite3
import uuid
import time
import os

app = FastAPI(title="PolyTrack Exchange API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock this down to your domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.environ.get("DB_PATH", "polytrack.db")


# ── Database setup ─────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS tracks (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            author      TEXT NOT NULL,
            code        TEXT NOT NULL,
            description TEXT DEFAULT '',
            tags        TEXT DEFAULT '',
            thumbnail   TEXT DEFAULT '',
            likes       INTEGER DEFAULT 0,
            plays       INTEGER DEFAULT 0,
            created_at  INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS campaigns (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            author      TEXT NOT NULL,
            description TEXT DEFAULT '',
            track_ids   TEXT NOT NULL,
            created_at  INTEGER NOT NULL
        );
    """)
    conn.commit()
    conn.close()


init_db()


# ── Models ─────────────────────────────────────────────────────────────────────

class TrackUpload(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    author: str = Field(..., min_length=1, max_length=50)
    code: str = Field(..., min_length=1)
    description: str = Field("", max_length=500)
    tags: List[str] = Field(default_factory=list)
    thumbnail: str = Field("", max_length=2000)  # base64 or URL


class CampaignUpload(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    author: str = Field(..., min_length=1, max_length=50)
    description: str = Field("", max_length=500)
    track_ids: List[str] = Field(..., min_items=1)


def row_to_track(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "author": row["author"],
        "code": row["code"],
        "description": row["description"],
        "tags": row["tags"].split(",") if row["tags"] else [],
        "thumbnail": row["thumbnail"],
        "likes": row["likes"],
        "plays": row["plays"],
        "created_at": row["created_at"],
    }


def row_to_campaign(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "author": row["author"],
        "description": row["description"],
        "track_ids": row["track_ids"].split(","),
        "created_at": row["created_at"],
    }


# ── Track endpoints ────────────────────────────────────────────────────────────

@app.get("/tracks", summary="List and search tracks")
def list_tracks(
    search: Optional[str] = Query(None, description="Search by name or author"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    sort: str = Query("newest", enum=["newest", "popular", "most_played"]),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    conn = get_db()
    where_clauses = []
    params = []

    if search:
        where_clauses.append("(name LIKE ? OR author LIKE ?)")
        params += [f"%{search}%", f"%{search}%"]
    if tag:
        where_clauses.append("tags LIKE ?")
        params.append(f"%{tag}%")

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    sort_map = {
        "newest": "created_at DESC",
        "popular": "likes DESC",
        "most_played": "plays DESC",
    }
    order_sql = f"ORDER BY {sort_map[sort]}"

    offset = (page - 1) * limit
    rows = conn.execute(
        f"SELECT * FROM tracks {where_sql} {order_sql} LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()

    total = conn.execute(
        f"SELECT COUNT(*) FROM tracks {where_sql}", params
    ).fetchone()[0]

    conn.close()
    return {
        "tracks": [row_to_track(r) for r in rows],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // limit)),  # ceiling division
    }


@app.get("/tracks/{track_id}", summary="Get a single track")
def get_track(track_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Track not found")
    return row_to_track(row)


@app.post("/tracks", status_code=201, summary="Upload a track")
def upload_track(track: TrackUpload):
    track_id = str(uuid.uuid4())[:8]
    now = int(time.time())
    conn = get_db()
    conn.execute(
        "INSERT INTO tracks (id, name, author, code, description, tags, thumbnail, created_at) VALUES (?,?,?,?,?,?,?,?)",
        (track_id, track.name, track.author, track.code,
         track.description, ",".join(track.tags), track.thumbnail, now),
    )
    conn.commit()
    conn.close()
    return {"id": track_id, "message": "Track uploaded successfully"}


@app.post("/tracks/{track_id}/like", summary="Like a track")
def like_track(track_id: str):
    conn = get_db()
    result = conn.execute("UPDATE tracks SET likes = likes + 1 WHERE id = ?", (track_id,))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"message": "Liked!"}


@app.post("/tracks/{track_id}/play", summary="Increment play count")
def play_track(track_id: str):
    conn = get_db()
    result = conn.execute("UPDATE tracks SET plays = plays + 1 WHERE id = ?", (track_id,))
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"message": "Play recorded"}


# ── Campaign endpoints ─────────────────────────────────────────────────────────

@app.get("/campaigns", summary="List campaigns")
def list_campaigns(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    conn = get_db()
    where_sql = ""
    params = []
    if search:
        where_sql = "WHERE name LIKE ? OR author LIKE ?"
        params = [f"%{search}%", f"%{search}%"]

    offset = (page - 1) * limit
    rows = conn.execute(
        f"SELECT * FROM campaigns {where_sql} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    total = conn.execute(f"SELECT COUNT(*) FROM campaigns {where_sql}", params).fetchone()[0]
    conn.close()
    return {
        "campaigns": [row_to_campaign(r) for r in rows],
        "total": total,
        "page": page,
        "pages": max(1, -(-total // limit)),
    }


@app.get("/campaigns/{campaign_id}", summary="Get a campaign with full track data")
def get_campaign(campaign_id: str):
    conn = get_db()
    row = conn.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign = row_to_campaign(row)
    # Hydrate with full track objects
    tracks = []
    for tid in campaign["track_ids"]:
        t = conn.execute("SELECT * FROM tracks WHERE id = ?", (tid,)).fetchone()
        if t:
            tracks.append(row_to_track(t))
    conn.close()
    campaign["tracks"] = tracks
    return campaign


@app.post("/campaigns", status_code=201, summary="Create a campaign")
def create_campaign(campaign: CampaignUpload):
    # Verify all tracks exist
    conn = get_db()
    for tid in campaign.track_ids:
        if not conn.execute("SELECT id FROM tracks WHERE id = ?", (tid,)).fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail=f"Track '{tid}' not found")

    campaign_id = str(uuid.uuid4())[:8]
    now = int(time.time())
    conn.execute(
        "INSERT INTO campaigns (id, name, author, description, track_ids, created_at) VALUES (?,?,?,?,?,?)",
        (campaign_id, campaign.name, campaign.author,
         campaign.description, ",".join(campaign.track_ids), now),
    )
    conn.commit()
    conn.close()
    return {"id": campaign_id, "message": "Campaign created successfully"}


@app.get("/health")
def health():
    return {"status": "ok"}
