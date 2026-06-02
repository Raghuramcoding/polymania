// PolyTrack Exchange Mod v1.0.0
// Injects: Track Browser + Campaign Browser into the main menu
// Backend: change API_BASE to wherever you deploy the FastAPI server

const API_BASE = "postgres-production-761f.up.railway.app";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function loadTrackCode(code) {
  // PolyTrack reads the track code from the URL hash — set it and trigger a load
  // This mimics pasting a code into the game's own import box
  const importInput = document.querySelector('input[placeholder*="code"], input[placeholder*="Code"]');
  if (importInput) {
    importInput.value = code;
    importInput.dispatchEvent(new Event("input", { bubbles: true }));
    // Find and click the load/import button near the input
    const btn = importInput.closest("div")?.querySelector("button");
    if (btn) btn.click();
  } else {
    // Fallback: copy to clipboard and alert
    navigator.clipboard.writeText(code);
    alert("Track code copied to clipboard! Paste it into the track code field.");
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .ptx-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.85);
      display: flex; flex-direction: column;
      font-family: 'Segoe UI', sans-serif;
      color: #fff;
    }
    .ptx-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 24px;
      background: #111;
      border-bottom: 2px solid #333;
    }
    .ptx-header h1 { margin: 0; font-size: 1.4rem; letter-spacing: 1px; }
    .ptx-header .ptx-tabs { display: flex; gap: 8px; margin-left: auto; }
    .ptx-tab {
      padding: 6px 18px; border-radius: 20px; border: 2px solid #444;
      background: transparent; color: #aaa; cursor: pointer; font-size: 0.9rem;
      transition: all 0.15s;
    }
    .ptx-tab.active { background: #e8ff57; color: #111; border-color: #e8ff57; font-weight: 700; }
    .ptx-close {
      margin-left: 12px; background: #333; border: none; color: #fff;
      width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1.1rem;
    }
    .ptx-toolbar {
      display: flex; gap: 10px; padding: 14px 24px;
      background: #1a1a1a; border-bottom: 1px solid #2a2a2a; flex-wrap: wrap;
    }
    .ptx-toolbar input, .ptx-toolbar select {
      padding: 7px 14px; border-radius: 8px;
      border: 1px solid #333; background: #222; color: #fff; font-size: 0.9rem;
    }
    .ptx-toolbar input { flex: 1; min-width: 180px; }
    .ptx-btn {
      padding: 7px 18px; border-radius: 8px; border: none;
      background: #e8ff57; color: #111; font-weight: 700; cursor: pointer; font-size: 0.9rem;
    }
    .ptx-btn:hover { background: #d4eb40; }
    .ptx-btn.secondary { background: #333; color: #fff; }
    .ptx-btn.secondary:hover { background: #444; }
    .ptx-grid {
      flex: 1; overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px; padding: 20px 24px;
    }
    .ptx-card {
      background: #1e1e1e; border-radius: 12px; overflow: hidden;
      border: 1px solid #2a2a2a; cursor: pointer; transition: transform 0.15s, border-color 0.15s;
    }
    .ptx-card:hover { transform: translateY(-2px); border-color: #e8ff57; }
    .ptx-card-thumb {
      width: 100%; height: 130px; object-fit: cover;
      background: #111; display: flex; align-items: center; justify-content: center;
      font-size: 2.5rem;
    }
    .ptx-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .ptx-card-body { padding: 12px; }
    .ptx-card-title { font-weight: 700; font-size: 1rem; margin: 0 0 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ptx-card-meta { font-size: 0.78rem; color: #888; }
    .ptx-card-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .ptx-tag {
      background: #2a2a2a; color: #bbb; padding: 2px 8px;
      border-radius: 10px; font-size: 0.72rem;
    }
    .ptx-card-actions { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid #2a2a2a; }
    .ptx-card-actions button { flex: 1; }
    .ptx-pagination {
      display: flex; gap: 8px; align-items: center; justify-content: center;
      padding: 14px; background: #111; border-top: 1px solid #2a2a2a;
    }
    .ptx-empty { 
      grid-column: 1/-1; text-align: center; color: #555; padding: 60px;
      font-size: 1.1rem;
    }

    /* Campaign specific */
    .ptx-campaign-card { display: flex; flex-direction: column; }
    .ptx-campaign-tracks {
      display: flex; flex-direction: column; gap: 6px;
      padding: 10px 12px; border-top: 1px solid #2a2a2a;
    }
    .ptx-track-row {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; background: #242424; border-radius: 8px;
      cursor: pointer; transition: background 0.1s;
    }
    .ptx-track-row:hover { background: #2d2d2d; }
    .ptx-track-num {
      width: 22px; height: 22px; border-radius: 50%;
      background: #333; display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; flex-shrink: 0;
    }
    .ptx-track-num.done { background: #e8ff57; color: #111; }
    .ptx-track-name { flex: 1; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Upload modal */
    .ptx-modal {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center;
    }
    .ptx-modal-box {
      background: #1a1a1a; border-radius: 14px; padding: 28px;
      width: 420px; max-width: 95vw;
      border: 1px solid #333; display: flex; flex-direction: column; gap: 12px;
    }
    .ptx-modal-box h2 { margin: 0 0 4px; }
    .ptx-modal-box label { font-size: 0.85rem; color: #aaa; }
    .ptx-modal-box input, .ptx-modal-box textarea {
      width: 100%; padding: 8px 12px; border-radius: 8px;
      border: 1px solid #333; background: #111; color: #fff;
      font-size: 0.9rem; box-sizing: border-box;
    }
    .ptx-modal-box textarea { resize: vertical; min-height: 80px; }
    .ptx-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }

    /* Menu button injection */
    .ptx-menu-btn {
      background: #e8ff57; color: #111; border: none;
      padding: 10px 24px; border-radius: 8px;
      font-weight: 700; font-size: 1rem; cursor: pointer;
      margin: 4px 0; width: 100%;
    }
    .ptx-menu-btn:hover { background: #d4eb40; }
  `;
  document.head.appendChild(style);
}

// ── Upload Modal ──────────────────────────────────────────────────────────────

function showUploadModal(onSuccess) {
  const modal = document.createElement("div");
  modal.className = "ptx-modal";
  modal.innerHTML = `
    <div class="ptx-modal-box">
      <h2>📤 Upload Track</h2>
      <label>Track Name</label>
      <input id="ptx-u-name" placeholder="My Awesome Track" />
      <label>Your Name</label>
      <input id="ptx-u-author" placeholder="Anonymous" />
      <label>Track Code</label>
      <textarea id="ptx-u-code" placeholder="Paste PolyTrack code here..."></textarea>
      <label>Description (optional)</label>
      <input id="ptx-u-desc" placeholder="Short description..." />
      <label>Tags (comma separated, optional)</label>
      <input id="ptx-u-tags" placeholder="fun, hard, loops" />
      <p id="ptx-u-status" style="color:#888;font-size:0.85rem;margin:0"></p>
      <div class="ptx-modal-actions">
        <button class="ptx-btn secondary" id="ptx-u-cancel">Cancel</button>
        <button class="ptx-btn" id="ptx-u-submit">Upload</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#ptx-u-cancel").onclick = () => modal.remove();

  modal.querySelector("#ptx-u-submit").onclick = async () => {
    const status = modal.querySelector("#ptx-u-status");
    const body = {
      name: modal.querySelector("#ptx-u-name").value.trim(),
      author: modal.querySelector("#ptx-u-author").value.trim() || "Anonymous",
      code: modal.querySelector("#ptx-u-code").value.trim(),
      description: modal.querySelector("#ptx-u-desc").value.trim(),
      tags: modal.querySelector("#ptx-u-tags").value.split(",").map(t => t.trim()).filter(Boolean),
    };
    if (!body.name || !body.code) { status.textContent = "Name and code are required."; return; }
    status.textContent = "Uploading...";
    try {
      await apiFetch("/tracks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      status.style.color = "#8f8";
      status.textContent = "✅ Uploaded!";
      setTimeout(() => { modal.remove(); onSuccess?.(); }, 800);
    } catch (e) {
      status.style.color = "#f88";
      status.textContent = "Upload failed. Is the server running?";
    }
  };
}

// ── Track Browser ─────────────────────────────────────────────────────────────

async function buildTrackBrowser(container) {
  let page = 1, totalPages = 1;
  let search = "", sort = "newest";

  container.innerHTML = `
    <div class="ptx-toolbar">
      <input id="ptx-search" placeholder="🔍 Search tracks..." />
      <select id="ptx-sort">
        <option value="newest">Newest</option>
        <option value="popular">Most Liked</option>
        <option value="most_played">Most Played</option>
      </select>
      <button class="ptx-btn" id="ptx-refresh">Refresh</button>
      <button class="ptx-btn secondary" id="ptx-upload">+ Upload Track</button>
    </div>
    <div class="ptx-grid" id="ptx-track-grid"></div>
    <div class="ptx-pagination">
      <button class="ptx-btn secondary" id="ptx-prev">◀ Prev</button>
      <span id="ptx-page-info">Page 1</span>
      <button class="ptx-btn secondary" id="ptx-next">Next ▶</button>
    </div>
  `;

  const grid = container.querySelector("#ptx-track-grid");

  async function loadTracks() {
    grid.innerHTML = `<div class="ptx-empty">Loading...</div>`;
    try {
      const data = await apiFetch(`/tracks?search=${encodeURIComponent(search)}&sort=${sort}&page=${page}&limit=20`);
      totalPages = data.pages;
      container.querySelector("#ptx-page-info").textContent = `Page ${page} of ${totalPages}`;
      container.querySelector("#ptx-prev").disabled = page <= 1;
      container.querySelector("#ptx-next").disabled = page >= totalPages;

      if (data.tracks.length === 0) {
        grid.innerHTML = `<div class="ptx-empty">No tracks found. Be the first to upload one!</div>`;
        return;
      }

      grid.innerHTML = "";
      for (const t of data.tracks) {
        const card = document.createElement("div");
        card.className = "ptx-card";
        const completed = JSON.parse(localStorage.getItem("ptx-played") || "{}");
        card.innerHTML = `
          <div class="ptx-card-thumb">
            ${t.thumbnail ? `<img src="${t.thumbnail}" alt="thumb" />` : "🏁"}
          </div>
          <div class="ptx-card-body">
            <p class="ptx-card-title">${t.name}</p>
            <p class="ptx-card-meta">by ${t.author} · ❤️ ${t.likes} · ▶️ ${t.plays}</p>
            <p class="ptx-card-meta" style="margin-top:4px">${t.description || ""}</p>
            <div class="ptx-card-tags">${(t.tags || []).map(tag => `<span class="ptx-tag">${tag}</span>`).join("")}</div>
          </div>
          <div class="ptx-card-actions">
            <button class="ptx-btn" data-load>▶ Load</button>
            <button class="ptx-btn secondary" data-like>❤️</button>
          </div>
        `;
        card.querySelector("[data-load]").onclick = async () => {
          await apiFetch(`/tracks/${t.id}/play`, { method: "POST" });
          const played = JSON.parse(localStorage.getItem("ptx-played") || "{}");
          played[t.id] = true;
          localStorage.setItem("ptx-played", JSON.stringify(played));
          loadTrackCode(t.code);
        };
        card.querySelector("[data-like]").onclick = async () => {
          await apiFetch(`/tracks/${t.id}/like`, { method: "POST" });
          card.querySelector("[data-like]").textContent = "❤️ Liked!";
        };
        grid.appendChild(card);
      }
    } catch (e) {
      grid.innerHTML = `<div class="ptx-empty">⚠️ Could not connect to server.<br/><small>${e.message}</small></div>`;
    }
  }

  container.querySelector("#ptx-search").oninput = e => { search = e.target.value; page = 1; loadTracks(); };
  container.querySelector("#ptx-sort").onchange = e => { sort = e.target.value; page = 1; loadTracks(); };
  container.querySelector("#ptx-refresh").onclick = () => loadTracks();
  container.querySelector("#ptx-upload").onclick = () => showUploadModal(loadTracks);
  container.querySelector("#ptx-prev").onclick = () => { if (page > 1) { page--; loadTracks(); } };
  container.querySelector("#ptx-next").onclick = () => { if (page < totalPages) { page++; loadTracks(); } };

  loadTracks();
}

// ── Campaign Browser ──────────────────────────────────────────────────────────

async function buildCampaignBrowser(container) {
  let page = 1, totalPages = 1, search = "";

  container.innerHTML = `
    <div class="ptx-toolbar">
      <input id="ptx-csearch" placeholder="🔍 Search campaigns..." />
      <button class="ptx-btn" id="ptx-crefresh">Refresh</button>
    </div>
    <div class="ptx-grid" id="ptx-campaign-grid"></div>
    <div class="ptx-pagination">
      <button class="ptx-btn secondary" id="ptx-cprev">◀ Prev</button>
      <span id="ptx-cpage-info">Page 1</span>
      <button class="ptx-btn secondary" id="ptx-cnext">Next ▶</button>
    </div>
  `;

  const grid = container.querySelector("#ptx-campaign-grid");

  async function loadCampaigns() {
    grid.innerHTML = `<div class="ptx-empty">Loading...</div>`;
    try {
      const data = await apiFetch(`/campaigns?search=${encodeURIComponent(search)}&page=${page}&limit=12`);
      totalPages = data.pages;
      container.querySelector("#ptx-cpage-info").textContent = `Page ${page} of ${totalPages}`;

      if (data.campaigns.length === 0) {
        grid.innerHTML = `<div class="ptx-empty">No campaigns yet.</div>`;
        return;
      }

      grid.innerHTML = "";
      const progress = JSON.parse(localStorage.getItem("ptx-campaign-progress") || "{}");

      for (const c of data.campaigns) {
        // Fetch full campaign with track list
        const full = await apiFetch(`/campaigns/${c.id}`);
        const done = progress[c.id] || [];
        const card = document.createElement("div");
        card.className = "ptx-card ptx-campaign-card";

        const trackRows = full.tracks.map((t, i) => {
          const finished = done.includes(t.id);
          return `
            <div class="ptx-track-row" data-code="${encodeURIComponent(t.code)}" data-id="${t.id}" data-cid="${c.id}">
              <div class="ptx-track-num ${finished ? "done" : ""}">${finished ? "✓" : i + 1}</div>
              <span class="ptx-track-name">${t.name}</span>
              <span style="font-size:0.75rem;color:#666">by ${t.author}</span>
            </div>
          `;
        }).join("");

        card.innerHTML = `
          <div class="ptx-card-body">
            <p class="ptx-card-title">📋 ${c.name}</p>
            <p class="ptx-card-meta">by ${c.author} · ${full.tracks.length} tracks · ${done.length}/${full.tracks.length} done</p>
            <p class="ptx-card-meta" style="margin-top:4px">${c.description || ""}</p>
          </div>
          <div class="ptx-campaign-tracks">${trackRows}</div>
        `;

        card.querySelectorAll(".ptx-track-row").forEach(row => {
          row.onclick = () => {
            const code = decodeURIComponent(row.dataset.code);
            const tid = row.dataset.id;
            const cid = row.dataset.cid;
            const prog = JSON.parse(localStorage.getItem("ptx-campaign-progress") || "{}");
            if (!prog[cid]) prog[cid] = [];
            if (!prog[cid].includes(tid)) prog[cid].push(tid);
            localStorage.setItem("ptx-campaign-progress", JSON.stringify(prog));
            loadTrackCode(code);
          };
        });

        grid.appendChild(card);
      }
    } catch (e) {
      grid.innerHTML = `<div class="ptx-empty">⚠️ Could not connect to server.<br/><small>${e.message}</small></div>`;
    }
  }

  container.querySelector("#ptx-csearch").oninput = e => { search = e.target.value; page = 1; loadCampaigns(); };
  container.querySelector("#ptx-crefresh").onclick = () => loadCampaigns();
  container.querySelector("#ptx-cprev").onclick = () => { if (page > 1) { page--; loadCampaigns(); } };
  container.querySelector("#ptx-cnext").onclick = () => { if (page < totalPages) { page++; loadCampaigns(); } };

  loadCampaigns();
}

// ── Main Overlay ──────────────────────────────────────────────────────────────

function openExchange(defaultTab = "tracks") {
  if (document.querySelector(".ptx-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "ptx-overlay";
  overlay.innerHTML = `
    <div class="ptx-header">
      <span style="font-size:1.5rem">🏎️</span>
      <h1>PolyTrack Exchange</h1>
      <div class="ptx-tabs">
        <button class="ptx-tab ${defaultTab === "tracks" ? "active" : ""}" data-tab="tracks">Tracks</button>
        <button class="ptx-tab ${defaultTab === "campaigns" ? "active" : ""}" data-tab="campaigns">Campaigns</button>
      </div>
      <button class="ptx-close" id="ptx-close">✕</button>
    </div>
    <div id="ptx-content" style="flex:1;display:flex;flex-direction:column;overflow:hidden"></div>
  `;
  document.body.appendChild(overlay);

  const content = overlay.querySelector("#ptx-content");
  let currentTab = defaultTab;

  function switchTab(tab) {
    currentTab = tab;
    overlay.querySelectorAll(".ptx-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    if (tab === "tracks") buildTrackBrowser(content);
    else buildCampaignBrowser(content);
  }

  overlay.querySelectorAll(".ptx-tab").forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  overlay.querySelector("#ptx-close").onclick = () => overlay.remove();

  switchTab(defaultTab);
}

// ── Menu Injection ────────────────────────────────────────────────────────────
// PML mixin: watch for the main menu to appear, then inject our button

export function init(polymod) {
  injectStyles();

  // Watch for PolyTrack's menu container to appear in the DOM
  const observer = new MutationObserver(() => {
    // PolyTrack's main menu buttons are in a vertical flex container
    // Adjust this selector if PML's deobfuscated source reveals a better hook
    const menuContainer = document.querySelector(
      '.menu-buttons, [class*="menuButton"], [class*="main-menu"] button'
    )?.closest("div");

    if (menuContainer && !document.getElementById("ptx-menu-btn")) {
      const btn = document.createElement("button");
      btn.id = "ptx-menu-btn";
      btn.className = "ptx-menu-btn";
      btn.textContent = "🏎️ Track Exchange";
      btn.onclick = () => openExchange("tracks");
      menuContainer.appendChild(btn);

      const campBtn = document.createElement("button");
      campBtn.className = "ptx-menu-btn";
      campBtn.style.background = "#57aaff";
      campBtn.textContent = "📋 Campaigns";
      campBtn.onclick = () => openExchange("campaigns");
      menuContainer.appendChild(campBtn);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Also expose a global shortcut (Ctrl+E to open exchange)
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "e") { e.preventDefault(); openExchange("tracks"); }
    if (e.ctrlKey && e.key === "r") { e.preventDefault(); openExchange("campaigns"); }
  });

  polymod.log("PolyTrack Exchange loaded! Ctrl+E = Tracks, Ctrl+R = Campaigns");
}
