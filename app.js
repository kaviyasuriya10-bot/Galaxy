/* =========================================================
   MILKYMEMORY — FLASK + MYSQL FRONTEND
========================================================= */
let currentUser = null;
let memories = [];
let albums = [];
let currentMemoryId = null;
let editingId = null;
let zoomLevel = 100;

const $ = id => document.getElementById(id);

async function api(url, options = {}) {
  const opts = {...options, headers: {...(options.headers || {})}};
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const response = await fetch(url, opts);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value + 'T00:00:00').toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function toast(message) { alert(message); }

async function boot() {
  createBackgroundStars();
  try {
    const data = await api('/api/me');
    if (data.authenticated) await enterApp(data.user);
    else showLogin();
  } catch (_) { showLogin(); }
}

function showLogin() {
  $('loginScreen').classList.remove('hidden');
  $('app').classList.add('hidden');
}

async function login(username, password) {
  const data = await api('/api/login', {method:'POST', body:{username, password}});
  await enterApp(data.user);
}

async function register(username, password) {
  const data = await api('/api/register', {method:'POST', body:{username, password}});
  closeModal('registerModal');
  await enterApp(data.user);
}

async function enterApp(user) {
  currentUser = user;
  $('loginScreen').classList.add('hidden');
  $('app').classList.remove('hidden');
  updateUserUI();
  await refreshAll();
  showSection('galaxy');
}

function updateUserUI() {
  if (!currentUser) return;
  $('profileUsername').textContent = currentUser.username;
  $('menuUsername').textContent = currentUser.username;
  $('settingsUsername').textContent = 'Logged in as ' + currentUser.username;
  $('profileAvatar').textContent = currentUser.username.charAt(0).toUpperCase();
}

async function logout() {
  try { await api('/api/logout', {method:'POST'}); } catch (_) {}
  currentUser = null; memories = []; albums = [];
  closePanel(); showLogin();
}

async function refreshAll() {
  const [m, a] = await Promise.all([api('/api/memories'), api('/api/albums')]);
  memories = m.memories || [];
  albums = a.albums || [];
  renderGalaxy(); renderTimeline(); renderAlbums(); renderTags(); updateStats();
}

function createBackgroundStars() {
  const box = $('backgroundStars'); if (!box) return;
  box.innerHTML = '';
  for (let i=0; i<280; i++) {
    const star = document.createElement('div'); star.className='background-star';
    star.style.left = Math.random()*100+'%'; star.style.top = Math.random()*100+'%';
    const s = Math.random()*2+.5; star.style.width=s+'px'; star.style.height=s+'px';
    star.style.setProperty('--duration', (2+Math.random()*5)+'s'); star.style.animationDelay=Math.random()*5+'s';
    box.appendChild(star);
  }
}

function renderGalaxy() {
  const box = $('memoryStars'); if (!box) return;
  box.querySelectorAll('.memory-star').forEach(x=>x.remove());
  memories.forEach(memory => {
    const star = document.createElement('div'); star.className='memory-star';
    star.style.left=memory.x+'%'; star.style.top=memory.y+'%'; star.style.setProperty('--star-color', memory.color || '#b084ff');
    star.title = memory.title;
    star.innerHTML = `<div class="memory-label"><strong>${escapeHTML(memory.title)}</strong><span>${formatDate(memory.date)}</span></div>`;
    star.addEventListener('click', e => {e.stopPropagation(); openMemoryPanel(memory.id);});
    box.appendChild(star);
  });
  $('emptyMessage').classList.toggle('hidden', memories.length !== 0);
}

function openMemoryPanel(id) {
  const memory = memories.find(m=>m.id===Number(id)); if (!memory) return;
  currentMemoryId=memory.id;
  $('panelTitle').textContent=memory.title; $('panelDate').textContent=formatDate(memory.date); $('panelDescription').textContent=memory.description || 'No description added.';
  $('panelStar').style.color=memory.color || '#b57cff';
  const img=$('panelImage'); if (memory.image) {img.src=memory.image; img.classList.add('visible');} else {img.removeAttribute('src'); img.classList.remove('visible');}
  renderPanelTags(memory); renderMiniMemories(memory); $('memoryPanel').classList.add('open');
}
function closePanel(){ $('memoryPanel').classList.remove('open'); currentMemoryId=null; }
function renderPanelTags(memory){ $('panelTags').innerHTML=(memory.tags||[]).map(t=>`<span class="panel-tag">${escapeHTML(t)}</span>`).join(''); }
function renderMiniMemories(memory){
  const related=memories.filter(m=>m.id!==memory.id && (m.tags||[]).some(t=>(memory.tags||[]).includes(t))).slice(0,4);
  $('panelMiniMemories').innerHTML=related.map(m=>`<button class="mini-memory" data-id="${m.id}">${escapeHTML(m.title)}</button>`).join('');
  $('panelMiniMemories').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openMemoryPanel(b.dataset.id));
}

function openMemoryModal(memory=null) {
  editingId = memory ? memory.id : null;
  $('memoryModalTitle').textContent = memory ? 'Edit Memory' : 'Create a Memory';
  $('memorySubmit').textContent = memory ? '✎ Save Changes' : '✦ Create Memory';
  $('memoryForm').reset();
  if (memory) { $('memoryTitle').value=memory.title; $('memoryDate').value=memory.date; $('memoryDescription').value=memory.description||''; $('memoryTags').value=(memory.tags||[]).join(', '); }
  else $('memoryDate').value=new Date().toISOString().slice(0,10);
  $('memoryModal').classList.remove('hidden');
}
function closeMemoryModal(){ closeModal('memoryModal'); editingId=null; }
function closeModal(id){ $(id).classList.add('hidden'); }

async function saveMemory(e){
  e.preventDefault();
  const fd=new FormData(); fd.append('title',$('memoryTitle').value.trim()); fd.append('date',$('memoryDate').value); fd.append('description',$('memoryDescription').value.trim()); fd.append('tags',$('memoryTags').value.trim());
  if ($('memoryImage').files[0]) fd.append('image',$('memoryImage').files[0]);
  try {
    if (editingId) await api('/api/memories/'+editingId,{method:'PUT',body:fd});
    else await api('/api/memories',{method:'POST',body:fd});
    closeMemoryModal(); await refreshAll(); if(editingId) openMemoryPanel(editingId);
  } catch(err){ toast(err.message); }
}

async function deleteCurrentMemory(){
  if(!currentMemoryId) return; const memory=memories.find(m=>m.id===currentMemoryId); if(!memory) return;
  if(!confirm(`Delete "${memory.title}"?`)) return;
  try { await api('/api/memories/'+currentMemoryId,{method:'DELETE'}); closePanel(); await refreshAll(); } catch(err){toast(err.message);}
}
function editCurrentMemory(){ const m=memories.find(x=>x.id===currentMemoryId); if(m) openMemoryModal(m); }

function renderTimeline(){
  const box=$('timelineList'); if(!box) return; box.innerHTML='';
  if(!memories.length){box.appendChild(emptyMessage('No memories yet. Add your first star.'));return;}
  [...memories].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(m=>{
    const item=document.createElement('div'); item.className='timeline-item';
    item.innerHTML=`<div class="timeline-dot" style="background:${m.color}">✦</div><div class="timeline-card"><div class="timeline-date">${formatDate(m.date)}</div><h3>${escapeHTML(m.title)}</h3><p>${escapeHTML(m.description||'No description.')}</p><div class="timeline-tags">${(m.tags||[]).map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div></div>`;
    item.querySelector('.timeline-card').onclick=()=>openMemoryPanel(m.id); box.appendChild(item);
  });
}
function renderAlbums(){
  const box=$('albumsGrid'); if(!box) return; box.innerHTML='';
  if(!albums.length){box.appendChild(emptyMessage('No albums yet. Create your first collection.'));return;}
  albums.forEach(a=>{const card=document.createElement('div');card.className='album-card';card.innerHTML=`<div class="album-cover">▧</div><div class="album-info"><h3>${escapeHTML(a.name)}</h3><p>${a.memoryCount} ${a.memoryCount===1?'memory':'memories'}</p><small>${escapeHTML(a.description||'')}</small><button class="album-delete">Delete</button></div>`;card.querySelector('.album-delete').onclick=async e=>{e.stopPropagation();if(confirm('Delete this album? Memories will remain.')){await api('/api/albums/'+a.id,{method:'DELETE'});await refreshAll();}};box.appendChild(card);});
}
function renderTags(){
  const counts={}; memories.forEach(m=>(m.tags||[]).forEach(t=>counts[t]=(counts[t]||0)+1));
  $('tagsContainer').innerHTML=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([t,c])=>`<button class="tag-button" data-tag="${escapeHTML(t)}">${escapeHTML(t)} · ${c}</button>`).join('');
  $('tagsContainer').querySelectorAll('[data-tag]').forEach(b=>b.onclick=()=>showTag(b.dataset.tag));
}
function showTag(tag){ showSection('tags'); $('tagMemories').innerHTML=''; memories.filter(m=>(m.tags||[]).includes(tag)).forEach(m=>$('tagMemories').appendChild(createMemoryCard(m))); }
function createMemoryCard(m){const card=document.createElement('article');card.className='memory-card';card.innerHTML=`<div class="memory-card-star" style="color:${m.color}">★</div><h3>${escapeHTML(m.title)}</h3><div class="date">${formatDate(m.date)}</div><p>${escapeHTML(m.description||'No description.')}</p>`;card.onclick=()=>openMemoryPanel(m.id);return card;}
function emptyMessage(text){const d=document.createElement('div');d.className='empty-inline';d.textContent=text;return d;}

async function performSearch(){ const q=$('searchInput').value.trim(); const box=$('searchResults'); try{const data=await api('/api/search?q='+encodeURIComponent(q));box.innerHTML='';data.memories.forEach(m=>box.appendChild(createMemoryCard(m)));if(!data.memories.length)box.appendChild(emptyMessage('No memories found in your galaxy.'));}catch(err){toast(err.message);} }
function globalSearch(){const q=$('globalSearch').value.trim();showSection('search');$('searchInput').value=q;performSearch();}

function updateStats(){
  $('memoryCount').textContent=memories.length; $('starCount').textContent=memories.length; $('albumCount').textContent=albums.length;
  if(memories.length){const oldest=Math.min(...memories.map(m=>new Date(m.date+'T00:00:00').getTime()));$('daysCount').textContent=Math.max(1,Math.floor((Date.now()-oldest)/86400000));}else $('daysCount').textContent=0;
}
function showSection(section){
  document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active-section')); const target=$(section+'Section'); if(!target)return; target.classList.add('active-section');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.section===section));
  if(section==='timeline')renderTimeline(); if(section==='albums')renderAlbums(); if(section==='tags')renderTags(); if(section==='search')performSearch();
}

function openAlbumModal(){
  $('albumMemorySelector').innerHTML=memories.map(m=>`<label><input type="checkbox" value="${m.id}"> ${escapeHTML(m.title)}</label>`).join('') || '<p>No memories yet.</p>';
  $('albumModal').classList.remove('hidden');
}
async function saveAlbum(e){e.preventDefault();const ids=[...$('albumMemorySelector').querySelectorAll('input:checked')].map(x=>Number(x.value));try{await api('/api/albums',{method:'POST',body:{name:$('albumName').value.trim(),description:$('albumDescription').value.trim(),memoryIds:ids}});closeModal('albumModal');$('albumForm').reset();await refreshAll();}catch(err){toast(err.message);}}

async function askAI(){const input=$('aiInput');const q=input.value.trim();if(!q)return;const user=document.createElement('div');user.className='ai-message user';user.textContent=q;$('aiMessages').appendChild(user);input.value='';try{const data=await api('/api/ai',{method:'POST',body:{question:q}});const bot=document.createElement('div');bot.className='ai-message';bot.textContent=data.answer;$('aiMessages').appendChild(bot);$('aiMessages').scrollTop=$('aiMessages').scrollHeight;}catch(err){toast(err.message);}}

function changeZoom(direction){zoomLevel=Math.max(70,Math.min(150,zoomLevel+direction*10));$('zoomValue').textContent=zoomLevel+'%';$('galaxy').style.transform=`scale(${zoomLevel/100})`;}
function toggleTheme(){document.body.classList.toggle('light-mode');}
function toggleAnimation(){const on=$('animationToggle').checked;document.querySelectorAll('.background-star,.galaxy-nebula').forEach(x=>x.style.animationPlayState=on?'running':'paused');}

$('loginForm').addEventListener('submit',async e=>{e.preventDefault();$('loginMessage').textContent='';try{await login($('loginUsername').value.trim(),$('loginPassword').value);}catch(err){$('loginMessage').textContent=err.message;}});
$('createAccountButton').onclick=()=>{$('registerMessage').textContent='';$('registerForm').reset();$('registerModal').classList.remove('hidden');};
$('registerClose').onclick=()=>closeModal('registerModal');
$('registerForm').addEventListener('submit',async e=>{e.preventDefault();$('registerMessage').textContent='';if($('registerPassword').value!==$('registerConfirm').value){$('registerMessage').textContent='Passwords do not match.';return;}try{await register($('registerUsername').value.trim(),$('registerPassword').value);}catch(err){$('registerMessage').textContent=err.message;}});
$('logoutButton').onclick=logout;$('settingsLogout').onclick=logout;
$('profileButton').onclick=e=>{e.stopPropagation();$('profileMenu').classList.toggle('hidden');};document.addEventListener('click',e=>{if(!$('profileMenu').contains(e.target)&&!$('profileButton').contains(e.target))$('profileMenu').classList.add('hidden');});
$('addMemoryButton').onclick=()=>openMemoryModal();$('timelineAddButton').onclick=()=>openMemoryModal();$('emptyAddButton').onclick=()=>openMemoryModal();$('memoryModalClose').onclick=closeMemoryModal;$('memoryForm').addEventListener('submit',saveMemory);
$('closePanel').onclick=closePanel;$('editMemory').onclick=editCurrentMemory;$('deleteMemory').onclick=deleteCurrentMemory;
$('createAlbumButton').onclick=openAlbumModal;$('albumModalClose').onclick=()=>closeModal('albumModal');$('albumForm').addEventListener('submit',saveAlbum);
$('zoomIn').onclick=()=>changeZoom(1);$('zoomOut').onclick=()=>changeZoom(-1);$('themeButton').onclick=toggleTheme;$('settingsTheme').onclick=toggleTheme;$('notificationButton').onclick=()=>toast('✨ Your galaxy is waiting for you.');
$('globalSearch').addEventListener('keydown',e=>{if(e.key==='Enter')globalSearch();});$('searchButton').onclick=performSearch;$('searchInput').addEventListener('keydown',e=>{if(e.key==='Enter')performSearch();});
$('aiSend').onclick=askAI;$('aiInput').addEventListener('keydown',e=>{if(e.key==='Enter')askAI();});$('animationToggle').addEventListener('change',toggleAnimation);
document.querySelectorAll('.nav-item').forEach(n=>n.onclick=()=>showSection(n.dataset.section));
$('galaxy').addEventListener('click',()=>closePanel());
$('memoryPanel').addEventListener('click',e=>e.stopPropagation());
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePanel();closeMemoryModal();closeModal('registerModal');closeModal('albumModal');}});
boot();
