// frontend/script.js
const API = "https://bect-project.onrender.com/api"; // <= replace if different
// read token/username from localStorage
function getToken(){ return localStorage.getItem("token"); }
function getUsername(){ return localStorage.getItem("username"); }
function setAuth(token, username){ localStorage.setItem("token", token); localStorage.setItem("username", username); }
function clearAuth(){ localStorage.removeItem("token"); localStorage.removeItem("username"); }

// small helper for fetch with auth
async function apiFetch(path, opts = {}) {
  opts.headers = opts.headers || {};
  const token = getToken();
  if (token) opts.headers.Authorization = `Bearer ${token}`;
  opts.headers['Accept'] = 'application/json';
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json().catch(()=>({}));
  if (!res.ok) {
    data.ok = false;
    data.status = res.status;
  }
  return data;
}

// --- page-specific initializers
document.addEventListener("DOMContentLoaded", ()=>{
  const path = location.pathname.split("/").pop();

  // header user display and common buttons
  const userTopElem = document.getElementById("userTop");
  const loginBtn = document.getElementById("loginBtn");
  const publishBtn = document.getElementById("publishBtn");
  const adminBtn = document.getElementById("adminBtn");
  if (userTopElem) {
    const username = getUsername();
    if (username) {
      userTopElem.innerHTML = `<a href="utilisateur.html">${username}</a> <button id="logoutBtn">Déconnexion</button>`;
      document.getElementById("logoutBtn").addEventListener("click", ()=>{
        clearAuth();
        location.href = "login.html";
      });
    } else {
      userTopElem.innerHTML = `<a href="login.html">Se connecter</a>`;
    }
  }
  if (loginBtn) loginBtn.addEventListener("click", ()=> location.href = "login.html");
  if (publishBtn) publishBtn.addEventListener("click", ()=> {
    if (!getToken()) return location.href = "login.html";
    location.href = "publier.html";
  });
  if (adminBtn) adminBtn.addEventListener("click", ()=> location.href = "admin.html");

  if (path === "" || path === "index.html") initIndex();
  if (path === "login.html") initConnex();
  if (path === "publier.html") initPublish();
  if (path === "niveau.html") initNiveau();
  if (path === "utilisateur.html") initUserPage();
  if (path === "admin.html") initAdmin();
});

// INDEX
async function initIndex(){
  const grid = document.getElementById("levelsGrid");
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");
  async function load(q=""){
    grid.innerHTML = "<p>Chargement...</p>";
    const res = await apiFetch(`/levels${q?('?q='+encodeURIComponent(q)):""}`, { method: "GET" });
    if (!res.success) { grid.innerHTML = "<p>Erreur de chargement</p>"; return; }
    const levels = res.levels || [];
    if (levels.length === 0) { grid.innerHTML = "<p>Aucun niveau publié</p>"; return; }
    grid.innerHTML = "";
    levels.forEach(l=>{
      const div = document.createElement("div"); div.className = "card";
      const img = l.images && l.images[0] ? `<img src="${l.images[0]}" />` : `<div style="height:140px;background:#072; border-radius:6px"></div>`;
      div.innerHTML = `<h3>${escapeHtml(l.title)}</h3><p>Par <a href="utilisateur.html?u=${encodeURIComponent(l.creator)}">${escapeHtml(l.creator)}</a></p>${img}<p><a href="niveau.html?id=${l._id}">Ouvrir</a></p>`;
      grid.appendChild(div);
    });
  }
  load();
  if (searchBtn && searchInput) searchBtn.addEventListener("click", ()=> load(searchInput.value.trim()));
}

// CONNEXION / REGISTER
function initConnex(){
  const usernameEl = document.getElementById("username");
  const passwordEl = document.getElementById("password");
  const btnLogin = document.getElementById("btnLogin");
  const btnRegister = document.getElementById("btnRegister");
  const authMsg = document.getElementById("authMsg");

  btnRegister.addEventListener("click", async ()=>{
    authMsg.textContent = "Inscription...";
    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    if (!username || !password) return authMsg.textContent = "Remplis tous les champs";
    const res = await fetch(`${API}/register`, {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ username, password })
    }).then(r=>r.json());
    if (res.success) {
      // register returns token? our backend returns token on register — if not, do login
      if (res.token) {
        setAuth(res.token, res.username || username);
        location.href = "index.html";
      } else {
        // fallback: login
        const l = await fetch(`${API}/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ username, password }) }).then(r=>r.json());
        if (l.success) { setAuth(l.token, l.username); location.href = "index.html"; }
        else authMsg.textContent = l.message || "Inscription ok — connecte toi";
      }
    } else authMsg.textContent = res.message || "Erreur inscription";
  });

  btnLogin.addEventListener("click", async ()=>{
    authMsg.textContent = "Connexion...";
    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    if (!username || !password) return authMsg.textContent = "Remplis tous les champs";
    const res = await fetch(`${API}/login`, {
      method:"POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ username, password })
    }).then(r=>r.json());
    if (res.success) { setAuth(res.token, res.username); location.href = "index.html"; }
    else authMsg.textContent = res.message || "Erreur connexion";
  });
}

// PUBLISH
function initPublish(){
  const form = document.getElementById("publishForm");
  const publishMsg = document.getElementById("publishMsg");
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (!getToken()) return location.href="connexion.html";
    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const jsonFile = document.getElementById("jsonFile").files[0];
    const images = Array.from(document.getElementById("images").files).slice(0,3);
    if (!title || !jsonFile) { publishMsg.textContent="Titre et JSON requis"; return; }

    // check total size <= 3MB
    let total = jsonFile.size + images.reduce((s,f)=>s+f.size,0);
    if (total > 3 * 1024 * 1024) { publishMsg.textContent = "Total fichiers > 3MB"; return; }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("jsonFile", jsonFile);
    images.forEach(f=> formData.append("images", f));

    publishMsg.textContent = "Upload en cours...";
    const token = getToken();
    const res = await fetch(`${API}/upload`, {
      method:"POST",
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
      body: formData
    }).then(r=>r.json());

    if (res.success) {
      publishMsg.textContent = "Niveau publié !";
      location.href = "index.html";
    } else {
      publishMsg.textContent = res.message || "Erreur publication";
    }
  });

  document.getElementById("cancelPublish").addEventListener("click", ()=> location.href = "index.html");
}

// NIVEAU VIEW
async function initNiveau(){
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const area = document.getElementById("levelArea");
  if (!id) { area.innerHTML = "<p>Id manquant</p>"; return; }
  area.innerHTML = "<p>Chargement...</p>";
  const res = await apiFetch(`/levels/${id}`, { method: "GET" });
  if (!res.success) { area.innerHTML = "<p>Erreur</p>"; return; }
  const l = res.level;
  document.getElementById("lvlTitle").innerText = l.title;
  let imgs = "";
  (l.images || []).forEach(src => imgs += `<img src="${src}" style="max-width:100%;margin-bottom:8px;border-radius:8px" />`);
  area.innerHTML = `<h2>${escapeHtml(l.title)}</h2>
    <p>Par <a href="utilisateur.html?u=${encodeURIComponent(l.creator)}">${escapeHtml(l.creator)}</a></p>
    <div>${imgs}</div>
    <h3>Description</h3>
    <p>${escapeHtml(l.description||"")}</p>
    <p><button id="downloadJson">Télécharger JSON</button></p>`;

  document.getElementById("downloadJson").addEventListener("click", async ()=>{
    const d = await apiFetch(`/levels/${id}/download`, { method: "GET" });
    if (d.success && d.url) {
      // open url in new tab (Cloudinary direct) - browser will download
      window.open(d.url, "_blank");
    } else alert("Erreur téléchargement");
  });
}

// USER PAGE
async function initUserPage(){
  const params = new URLSearchParams(location.search);
  const username = params.get("u") || getUsername();
  if (!username) { document.getElementById("userHeader").innerText = "Utilisateur"; return; }
  document.getElementById("userHeader").innerText = `${username} - Mes niveaux`;
  const res = await apiFetch(`/users/${encodeURIComponent(username)}/levels`, { method: "GET" });
  const grid = document.getElementById("userLevels");
  if (!res.success) { grid.innerHTML = "<p>Erreur</p>"; return; }
  const list = res.levels || [];
  if (list.length === 0) { grid.innerHTML = "<p>Aucun niveau</p>"; return; }
  grid.innerHTML = "";
  list.forEach(l=>{
    const div = document.createElement("div"); div.className = "card";
    const img = l.images && l.images[0] ? `<img src="${l.images[0]}" />` : "";
    div.innerHTML = `<h3>${escapeHtml(l.title)}</h3><p><a href="niveau.html?id=${l._id}">Voir</a></p>${img}`;
    grid.appendChild(div);
  });
}

// ADMIN
function initAdmin(){
  const btn = document.getElementById("adminLoginBtn");
  const adminKeyInput = document.getElementById("adminKey");
  const msg = document.getElementById("adminMsg");
  const usersList = document.getElementById("usersList");

  btn.addEventListener("click", async ()=>{
    const key = adminKeyInput.value.trim();
    if (!key) return msg.innerText = "Entrez la clé admin";
    const res = await fetch(`${API}/admin/login`, { method: "POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ adminKey: key }) }).then(r=>r.json());
    if (!res.success) { msg.innerText = "Clé invalide"; return; }
    setAuth(res.token, res.username);
    msg.innerText = "Admin connecté";
    // fetch users: we don't have a users list endpoint; for demo, fetch levels and extract users
    const levels = await apiFetch("/levels", { method: "GET" });
    if (!levels.success) { usersList.innerHTML = "<p>Erreur</p>"; return; }
    const users = [...new Set(levels.levels.map(l=>l.creator))];
    usersList.innerHTML = "";
    users.forEach(u=>{
      const d = document.createElement("div"); d.className = "card";
      d.innerHTML = `<p>${u}</p><button data-u="${u}" class="delUserBtn">Supprimer utilisateur</button>`;
      usersList.appendChild(d);
    });
    document.querySelectorAll(".delUserBtn").forEach(b=>{
      b.addEventListener("click", async (e)=>{
        const u = e.target.dataset.u;
        if(!confirm(`Supprimer ${u} et ses niveaux ?`)) return;
        const r = await apiFetch(`/users/${encodeURIComponent(u)}`, { method: "DELETE" });
        if (r.success) { alert("Supprimé"); location.reload(); } else alert("Erreur");
      });
    });
  });
}

// small helper escape
function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
