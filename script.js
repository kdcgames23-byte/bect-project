// URL de ton backend
const API_URL = "https://bect-project.onrender.com/api";

// --- Vérifier si l'utilisateur est connecté ---
const user = JSON.parse(localStorage.getItem("bect_user"));

// DOM Elements
const btnLogin = document.getElementById("btn-login");
const btnRegister = document.getElementById("btn-register");
const userInfo = document.getElementById("user-info");
const usernameDisplay = document.getElementById("username-display");
const btnLogout = document.getElementById("btn-logout");
const btnPublish = document.getElementById("btn-publish");
const btnAdmin = document.getElementById("btn-admin");
const searchInput = document.getElementById("search-input");
const btnSearch = document.getElementById("btn-search");
const searchResults = document.getElementById("search-results");

// Affichage selon connexion
if (user) {
  btnLogin.style.display = "none";
  btnRegister.style.display = "none";
  userInfo.style.display = "inline";
  usernameDisplay.textContent = user.username;
  btnPublish.style.display = "inline";
  if (user.role === "admin") btnAdmin.style.display = "inline";
  // if you want to allow ADMIN_KEY based admin UI, uncomment:
  // if (user.key === "20090805C0K1D2M98347TA@") btnAdmin.style.display = "inline";
} else {
  btnLogin.style.display = "inline";
  btnRegister.style.display = "inline";
  userInfo.style.display = "none";
  btnPublish.style.display = "none";
  btnAdmin.style.display = "none";
}

// --- Boutons navigation ---
btnLogin && btnLogin.addEventListener("click", () => window.location.href = "connexion.html");
btnRegister && btnRegister.addEventListener("click", () => window.location.href = "inscription.html");
btnPublish && btnPublish.addEventListener("click", () => { if (!user) { alert("Vous devez être connecté pour publier un niveau."); window.location.href = "connexion.html"; } else window.location.href = "publier.html"; });
btnAdmin && btnAdmin.addEventListener("click", () => { window.location.href = "admin.html"; });
btnLogout && btnLogout.addEventListener("click", () => { if (confirm("Voulez-vous vraiment vous déconnecter ?")) { localStorage.removeItem("bect_user"); window.location.reload(); } });
usernameDisplay && usernameDisplay.addEventListener("click", () => { window.location.href = `utilisateur.html?username=${encodeURIComponent(user?.username || '')}`; });

// --- Recherche ---
btnSearch && btnSearch.addEventListener("click", async () => {
  const query = searchInput.value.trim();
  if (!query) return;
  searchResults.innerHTML = "<p>Recherche en cours...</p>";

  try {
    const res = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data || data.length === 0) {
      searchResults.innerHTML = "<p>Aucun résultat trouvé</p>";
      return;
    }

    searchResults.innerHTML = "";
    data.forEach(item => {
      const div = document.createElement("div");
      div.classList.add("result-item");
      const img = item.images && item.images[0] ? item.images[0] : '';
      div.innerHTML = `
        <img src="${img}" alt="${item.title || 'niveau'}" style="width:120px;height:80px;object-fit:cover;border-radius:6px"/>
        <h3 style="cursor:pointer;">${item.title}</h3>
        <p>Créé par : <span class="creator-name" data-creator="${item.creator}">${item.creator}</span></p>
      `;

      const creatorElem = div.querySelector('.creator-name');
      creatorElem && creatorElem.addEventListener('click', () => { window.location.href = `utilisateur.html?username=${encodeURIComponent(item.creator)}`; });

      const titleElem = div.querySelector('h3');
      titleElem && titleElem.addEventListener('click', () => { window.location.href = `niveau.html?id=${encodeURIComponent(item._id)}`; });

      searchResults.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    searchResults.innerHTML = "<p>Erreur lors de la recherche</p>";
  }
});