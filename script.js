export const API_URL = "https://bect-project.onrender.com/api";
export const user = JSON.parse(localStorage.getItem("bect_user"));

// DOM
const btnLogin = document.getElementById("btn-login");
const btnRegister = document.getElementById("btn-register");
const btnLogout = document.getElementById("btn-logout");
const btnPublish = document.getElementById("btn-publish");
const btnAdmin = document.getElementById("btn-admin");
const usernameDisplay = document.getElementById("username-display");
const searchInput = document.getElementById("search-input");
const btnSearch = document.getElementById("btn-search");
const searchResults = document.getElementById("search-results");
const userInfo = document.getElementById("user-info");

// --- Affichage boutons ---
function updateNav(){
  if(user){
    btnLogin.style.display = "none";
    btnRegister.style.display = "none";
    btnPublish.style.display = "inline";
    usernameDisplay.textContent = user.username;
    userInfo.style.display = "inline";
    btnAdmin.style.display = user.role==="admin" ? "inline" : "none";
  } else {
    btnLogin.style.display = "inline";
    btnRegister.style.display = "inline";
    btnPublish.style.display = "none";
    btnAdmin.style.display = "none";
    userInfo.style.display = "none";
  }
}
updateNav();

// --- Navigation ---
btnLogin.addEventListener("click",()=>window.location.href="connexion.html");
btnRegister.addEventListener("click",()=>window.location.href="inscription.html");
btnLogout.addEventListener("click",()=>{
  localStorage.removeItem("bect_user");
  window.location.reload();
});
btnPublish.addEventListener("click",()=>{
  if(!user){ alert("Connectez-vous"); window.location.href="connexion.html"; }
  else window.location.href="publier.html";
});
btnAdmin.addEventListener("click",()=>window.location.href="admin.html");
usernameDisplay.addEventListener("click",()=>{
  window.location.href=`utilisateur.html?username=${encodeURIComponent(user.username)}`;
});

// --- Inscription ---
export async function registerUser(username,password){
  try{
    const res = await fetch(`${API_URL}/register`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username,password})
    });
    const data = await res.json();
    if(data.success){
      alert("Inscription réussie !");
      window.location.href="connexion.html";
    }
    return data;
  }catch(e){
    console.error("Erreur inscription:",e);
    return {success:false,message:"Erreur serveur"};
  }
}

// --- Connexion ---
export async function loginUser(username,password){
  try{
    const res = await fetch(`${API_URL}/login`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({username,password})
    });
    const data = await res.json();
    if(data.success){
      localStorage.setItem("bect_user",JSON.stringify({
        username:data.username,
        role:data.role,
        token:data.token
      }));
      window.location.href="index.html";
    }
    return data;
  }catch(e){
    console.error("Erreur login:",e);
    return {success:false,message:"Erreur serveur"};
  }
}

// --- Recherche ---
btnSearch.addEventListener("click", async()=>{
  const query = searchInput.value.trim();
  if(!query) return;
  searchResults.innerHTML="<p>Recherche en cours...</p>";
  try{
    const res = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();
    if(!data||data.length===0){ searchResults.innerHTML="<p>Aucun résultat</p>"; return; }
    searchResults.innerHTML="";
    data.forEach(item=>{
      const div=document.createElement("div");
      div.classList.add("result-item");
      const img = item.images?.[0]||'';
      div.innerHTML=`
        <img src="${img}" alt="${item.title}" style="width:120px;height:80px;object-fit:cover;border-radius:6px"/>
        <h3 style="cursor:pointer;">${item.title}</h3>
        <p>Créé par : <span class="creator-name" data-creator="${item.creator}">${item.creator}</span></p>
      `;
      div.querySelector('.creator-name')?.addEventListener('click',()=>{ window.location.href=`utilisateur.html?username=${encodeURIComponent(item.creator)}`; });
      div.querySelector('h3')?.addEventListener('click',()=>{ window.location.href=`niveau.html?id=${encodeURIComponent(item._id)}`; });
      searchResults.appendChild(div);
    });
  }catch(err){
    console.error(err);
    searchResults.innerHTML="<p>Erreur recherche</p>";
  }
});
