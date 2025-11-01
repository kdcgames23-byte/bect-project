export const API_URL = "https://bect-project.onrender.com/api";

// --- Vérifier si utilisateur connecté ---
export const user = JSON.parse(localStorage.getItem("bect_user"));

// DOM
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

// --- Affichage boutons ---
if(user){
  btnLogin?.style.setProperty("display","none");
  btnRegister?.style.setProperty("display","none");
  userInfo?.style.setProperty("display","inline");
  usernameDisplay.textContent = user.username;
  btnPublish?.style.setProperty("display","inline");
  if(user.role==="admin") btnAdmin?.style.setProperty("display","inline");
} else {
  btnLogin?.style.setProperty("display","inline");
  btnRegister?.style.setProperty("display","inline");
  userInfo?.style.setProperty("display","none");
  btnPublish?.style.setProperty("display","none");
  btnAdmin?.style.setProperty("display","none");
}

// --- Navigation boutons ---
btnLogin?.addEventListener("click",()=>window.location.href="connexion.html");
btnRegister?.addEventListener("click",()=>window.location.href="inscription.html");
btnPublish?.addEventListener("click",()=>{ 
  if(!user) { alert("Connectez-vous."); window.location.href="connexion.html"; }
  else window.location.href="publier.html"; 
});
btnAdmin?.addEventListener("click",()=>window.location.href="admin.html");
btnLogout?.addEventListener("click",()=>{ 
  if(confirm("Voulez-vous vous déconnecter ?")){
    localStorage.removeItem("bect_user");
    window.location.reload();
  } 
});
usernameDisplay?.addEventListener("click",()=>{ window.location.href=`utilisateur.html?username=${encodeURIComponent(user?.username||'')}`; });

// --- Recherche ---
btnSearch?.addEventListener("click", async ()=>{
  const query = searchInput.value.trim();
  if(!query) return;
  searchResults.innerHTML="<p>Recherche en cours...</p>";
  try {
    const res = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    if(!data || data.length===0){ searchResults.innerHTML="<p>Aucun résultat</p>"; return; }
    searchResults.innerHTML="";
    data.forEach(item=>{
      const div=document.createElement("div");
      div.classList.add("result-item");
      const img = item.images?.[0] || '';
      div.innerHTML=`
        <img src="${img}" alt="${item.title}" style="width:120px;height:80px;object-fit:cover;border-radius:6px"/>
        <h3 style="cursor:pointer;">${item.title}</h3>
        <p>Créé par : <span class="creator-name" data-creator="${item.creator}">${item.creator}</span></p>
      `;
      div.querySelector('.creator-name')?.addEventListener('click',()=>{ window.location.href=`utilisateur.html?username=${encodeURIComponent(item.creator)}`; });
      div.querySelector('h3')?.addEventListener('click',()=>{ window.location.href=`niveau.html?id=${encodeURIComponent(item._id)}`; });
      searchResults.appendChild(div);
    });
  } catch(err){ console.error(err); searchResults.innerHTML="<p>Erreur recherche</p>"; }
});
