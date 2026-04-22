const supabaseUrl = 'https://ddrjiaxonvfsnzpdkyfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkcmppYXhvbnZmc256cGRreWZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NzAzNTcsImV4cCI6MjA5MjM0NjM1N30.dpAryd0ybBWcDy-PQVhJkqRQuTiLk-_a4i1xqg-NXBo';
let supabase;
try {
  supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
} catch (err) {
  console.error("Supabase Init Error:", err);
}

// ─── HTML Escape ──────────────────────────────
function escapeHTML(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

// ─── Dark Mode Toggle ─────────────────────────
function toggleDarkMode() {
  const html = document.documentElement;
  html.classList.toggle('dark');
  const isDark = html.classList.contains('dark');
  localStorage.setItem('chariow_dark', isDark ? '1' : '0');
  document.querySelectorAll('.dark-icon').forEach(icon => {
    icon.textContent = isDark ? 'light_mode' : 'dark_mode';
  });
}
// Restore dark mode on load
(function() {
  const saved = localStorage.getItem('chariow_dark');
  if (saved === '0') {
    document.documentElement.classList.remove('dark');
    setTimeout(() => {
      document.querySelectorAll('.dark-icon').forEach(icon => { icon.textContent = 'dark_mode'; });
    }, 100);
  } else {
    // Default dark
    document.documentElement.classList.add('dark');
    setTimeout(() => {
      document.querySelectorAll('.dark-icon').forEach(icon => { icon.textContent = 'light_mode'; });
    }, 100);
  }
})();

// ─── Tracking System ──────────────────────────
let trackingInterval = null;
let currentDetailOrderId = null;

async function getMyOrders() {
  let myIds = [];
  try { myIds = JSON.parse(localStorage.getItem('chariow_my_orders') || '[]'); } catch(e) {}
  if (myIds.length === 0) return [];
  const { data, error } = await supabase.from('orders').select('*').in('id', myIds).order('created_at', { ascending: false });
  if (error) { console.error('Erreur getMyOrders:', error); return []; }
  return data.map(o => ({...o, date: o.created_at, serviceFee: o.service_fee}));
}

function getStatusInfo(status) {
  const map = {
    en_attente:   { label: 'En attente',    color: 'background:rgba(245,158,11,0.12);color:#f59e0b;', icon: 'schedule',    step: 1, eta: '45–60', msg: 'Le chef vérifie votre commande...' },
    validee:      { label: 'En préparation', color: 'background:rgba(59,130,246,0.12);color:#3b82f6;', icon: 'restaurant',  step: 2, eta: '20–30', msg: 'Le porc est sur le gril 🔥...' },
    en_livraison: { label: 'En livraison',   color: 'background:rgba(168,85,247,0.12);color:#a855f7;', icon: 'two_wheeler', step: 3, eta: '10–15', msg: 'Votre livreur est en route 🛵...' },
    livree:       { label: 'Livrée ✓',       color: 'background:rgba(34,197,94,0.12);color:#22c55e;',  icon: 'check_circle',step: 4, eta: '0',     msg: 'Commande livrée. Bon appétit ! 🎉' }
  };
  return map[status] || map.en_attente;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function renderOrdersList() {
  const orders = await getMyOrders();
  const container = document.getElementById('orders-list-container');
  const emptyEl = document.getElementById('orders-empty');
  const searchVal = (document.getElementById('order-search-input')?.value || '').toLowerCase();

  const active = orders.filter(o => o.status !== 'livree').length;
  const delivered = orders.filter(o => o.status === 'livree').length;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-delivered').textContent = delivered;
  document.getElementById('stat-total-orders').textContent = orders.length;

  const filtered = searchVal ? orders.filter(o => o.id.toLowerCase().includes(searchVal)) : orders;

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';

  container.innerHTML = filtered.map((order, i) => {
    const info = getStatusInfo(order.status);
    const itemCount = order.items.reduce((s, it) => s + it.qty, 0);
    const itemNames = order.items.map(it => it.name).join(', ');
    return `
      <div class="info-card" style="cursor:pointer;transition:all 0.3s;animation:slideUp 0.4s ${i * 0.06}s both;" onclick="openOrderDetail('${escapeHTML(order.id)}')" role="listitem" onmouseenter="this.style.borderColor='var(--border-accent)'" onmouseleave="this.style.borderColor='var(--border)'">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:10px;">
          <div>
            <h3 style="font-weight:800;font-size:15px;">#${escapeHTML(order.id.split('-')[1] || order.id)}</h3>
            <p style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${formatDate(order.date)}</p>
          </div>
          <span class="status-pill" style="${info.color}">${info.label}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <p style="font-size:12px;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%;">${escapeHTML(itemNames)} <strong>(${itemCount})</strong></p>
          <span style="font-family:Outfit;font-weight:800;font-size:14px;color:var(--accent);">${order.total.toLocaleString()} F</span>
        </div>
      </div>`;
  }).join('');
}

function filterOrders() { renderOrdersList(); }

function openOrderDetail(orderId) {
  currentDetailOrderId = orderId;
  document.getElementById('orders-list-view').style.display = 'none';
  document.getElementById('order-detail-view').style.display = 'block';
  document.getElementById('tracking-title').textContent = 'Suivi de Commande';
  updateOrderDetail();
  if (trackingInterval) clearInterval(trackingInterval);
  trackingInterval = setInterval(updateOrderDetail, 5000);
}

async function updateOrderDetail() {
  if (!currentDetailOrderId) return;
  const { data, error } = await supabase.from('orders').select('*').eq('id', currentDetailOrderId).single();
  if (error || !data) return;
  const order = {...data, date: data.created_at, serviceFee: data.service_fee};
  const info = getStatusInfo(order.status);

  document.getElementById('detail-order-id').textContent = '#' + (order.id.split('-')[1] || order.id);
  document.getElementById('detail-order-date').textContent = formatDate(order.date);
  document.getElementById('detail-status-pill').textContent = info.label;
  document.getElementById('detail-status-pill').setAttribute('style', info.color);

  const etaSection = document.getElementById('detail-eta-section');
  if (order.status === 'livree') { etaSection.style.display = 'none'; }
  else { etaSection.style.display = 'flex'; document.getElementById('detail-eta').textContent = info.eta; }

  const step = info.step;
  for (let i = 1; i <= 4; i++) {
    const icon = document.getElementById(`ts-${i}-icon`);
    const label = document.getElementById(`ts-${i}-label`);
    if (i <= step) {
      icon.style.cssText = 'width:40px;height:40px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;box-shadow:0 0 15px var(--accent-glow);transform:scale(1.1);transition:all 0.3s;';
      if (label) label.style.color = 'var(--accent)';
    } else {
      icon.style.cssText = 'width:40px;height:40px;border-radius:50%;background:var(--bg-elevated);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);transform:scale(1);transition:all 0.3s;';
      if (label) label.style.color = 'var(--text-tertiary)';
    }
  }
  if(document.getElementById('tl-line-1')) document.getElementById('tl-line-1').style.width = step >= 2 ? '100%' : '0%';
  if(document.getElementById('tl-line-2')) document.getElementById('tl-line-2').style.width = step >= 3 ? '100%' : '0%';
  if(document.getElementById('tl-line-3')) document.getElementById('tl-line-3').style.width = step >= 4 ? '100%' : '0%';

  document.getElementById('detail-status-msg').textContent = info.msg;
  const pulse = document.getElementById('detail-pulse');
  if (order.status === 'livree') {
    pulse.style.background = 'var(--success)';
    pulse.style.animation = 'none';
  } else {
    pulse.style.background = 'var(--accent)';
    pulse.style.animation = 'breathe 2s ease infinite';
  }

  const itemsList = document.getElementById('detail-items-list');
  itemsList.innerHTML = order.items.map(item => `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:var(--radius-sm);overflow:hidden;flex-shrink:0;">
          <img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"/>
        </div>
        <div>
          <p style="font-weight:700;font-size:13px;">${escapeHTML(item.name)} × ${item.qty}</p>
          ${item.accomp ? `<p style="font-size:11px;color:var(--accent);">+ ${escapeHTML(item.accomp.name)}</p>` : ''}
        </div>
      </div>
      <span style="font-weight:700;font-size:13px;color:var(--text-secondary);">${((item.totalPrice || item.price) * item.qty).toLocaleString()} F</span>
    </div>
  `).join('');
  document.getElementById('detail-total').textContent = order.total.toLocaleString() + ' FCFA';

  const reorderBtn = document.getElementById('btn-reorder');
  reorderBtn.style.display = order.status === 'livree' ? 'flex' : 'none';
}

async function reorderFromDetail() {
  if (!currentDetailOrderId) return;
  const { data: order, error } = await supabase.from('orders').select('*').eq('id', currentDetailOrderId).single();
  if (error || !order) return;
  order.items.forEach(item => {
    const product = products.find(p => p.name === item.name);
    if (product) { cart.push({ ...product, qty: item.qty, accomp: item.accomp || null, totalPrice: item.totalPrice || item.price }); }
  });
  updateBadges();
  showToast('Articles ajoutés au panier! 🛒');
  navigateTo('cart');
}

function trackingBack() {
  const detailView = document.getElementById('order-detail-view');
  if (detailView.style.display !== 'none') {
    detailView.style.display = 'none';
    document.getElementById('orders-list-view').style.display = 'block';
    document.getElementById('tracking-title').textContent = 'Mes Commandes';
    currentDetailOrderId = null;
    if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
    renderOrdersList();
  } else {
    navigateTo('shop');
  }
}

function renderTracking() {
  document.getElementById('orders-list-view').style.display = 'block';
  document.getElementById('order-detail-view').style.display = 'none';
  document.getElementById('tracking-title').textContent = 'Mes Commandes';
  currentDetailOrderId = null;
  if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
  renderOrdersList();
}


// ─── Data ─────────────────────────────────────
const products = [
  { id: 1, name: "Brochettes de Porc", subtitle: "Savoureuses et grillées", price: 4000, rating: 4.8, category: "braise", image: "./menu-porc/Brochettes.jpeg", desc: "De tendres morceaux de porc finement découpés, marinés aux épices locales et grillés sur des piques.", badge: "fire", orders: 67 },
  { id: 2, name: "Gras de Porc (Fats)", subtitle: "Fondant et croustillant", price: 3500, rating: 4.5, category: "frit", image: "./menu-porc/Pork Fats.jpeg", desc: "Morceaux de porc plus gras, frits jusqu'à devenir croustillants à l'extérieur et fondants à l'intérieur.", badge: null, orders: 34 },
  { id: 3, name: "Porc Braisé", subtitle: "Préparation maison", price: 6000, rating: 4.9, category: "braise", image: "./menu-porc/porc braise.jpeg", desc: "Notre fameux porc braisé, assaisonné avec nos épices secrètes et cuit à la perfection.", badge: "fire", orders: 89 },
  { id: 4, name: "Porc Super Spécial", subtitle: "Assortiment complet", price: 8500, rating: 4.7, category: "saute", image: "./menu-porc/porc super.jpeg", desc: "Une portion super spéciale des meilleurs morceaux de porc. Tendre, juteux et généreux.", badge: "promo", orders: 51 },
  { id: 5, name: "Méli-Mélo de Porc", subtitle: "Sauté au wok", price: 7000, rating: 4.6, category: "saute", image: "./menu-porc/c.jpeg", desc: "Un mélange de morceaux de porc sautés avec sa sauce d'accompagnement signature.", badge: "new", orders: 28 },
  { id: 6, name: "Attiéké", subtitle: "Semoule de manioc", price: 1000, rating: 4.6, category: "accompagnements", image: "./accompagnements/L'attiéké (semoule de manioc).jpeg", desc: "Semoule de manioc fraîchement préparée avec mélange tomate, oignon et piment doux.", badge: null, orders: 72 },
  { id: 7, name: "Alloco", subtitle: "Banane plantain frite", price: 1500, rating: 4.9, category: "accompagnements", image: "./accompagnements/Alloco.jpeg", desc: "Dés de banane plantain mûre, frits dorés. Doux et fondants.", badge: "fire", orders: 95 },
  { id: 8, name: "Ignames Bouillies", subtitle: "Idéal avec le braisé", price: 1200, rating: 4.5, category: "accompagnements", image: "./accompagnements/Ignames bouillies.jpeg", desc: "Généreux morceaux d'igname locale, bouillis à point.", badge: null, orders: 19 },
  { id: 9, name: "Riz Blanc", subtitle: "Riz parfumé", price: 1000, rating: 4.5, category: "accompagnements", image: "./accompagnements/riz.jpeg", desc: "Du riz blanc parfumé, préparé à la vapeur.", badge: null, orders: 45 },
  { id: 10, name: "Bière Locale Glacée", subtitle: "65cl", price: 1500, rating: 4.7, category: "boissons", image: "https://images.unsplash.com/photo-1600728618585-64de85fb4a49?q=80&w=600&auto=format&fit=crop", desc: "L'incontournable pour accompagner votre porc. 65cl bien fraîche.", badge: null, orders: 63 }
];

const accompagnements = products.filter(p => p.category === 'accompagnements');

// ─── State ────────────────────────────────────
let cart = [];
try { let s = localStorage.getItem('chariow_cart'); if (s) cart = JSON.parse(s); } catch(e) {}
if (!Array.isArray(cart)) cart = [];
let currentProduct = null;
let detailQty = 1;
let selectedAccomp = null;
let activeCategory = 'all';

// ─── Promo Timer ──────────────────────────────
function startPromoTimer() {
  let totalSeconds = 2 * 3600 + 30 * 60;
  const saved = localStorage.getItem('chariow_promo_end');
  if (saved) { const r = Math.floor((parseInt(saved) - Date.now()) / 1000); if (r > 0) totalSeconds = r; }
  else localStorage.setItem('chariow_promo_end', Date.now() + totalSeconds * 1000);
  const els = document.querySelectorAll('.promo-countdown');
  if (els.length === 0) return;
  setInterval(() => {
    if (totalSeconds <= 0) { els.forEach(el => el.textContent = "Expirée!"); return; }
    totalSeconds--;
    const h = Math.floor(totalSeconds / 3600), m = Math.floor((totalSeconds % 3600) / 60), s = totalSeconds % 60;
    els.forEach(el => el.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
  }, 1000);
}

// ─── Navigation ───────────────────────────────
function navigateTo(page) {
  // Masquer toutes les pages et activer la cible
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) { 
    target.classList.add('active'); 
    target.classList.remove('page-transition'); 
    void target.offsetWidth; 
    target.classList.add('page-transition'); 
  }
  window.scrollTo(0, 0);

  // Gérer la visibilité du bouton WhatsApp (visible sur Accueil, Menu et Suivi)
  const waFab = document.getElementById('whatsapp-fab');
  const showWa = ['welcome', 'shop', 'tracking'].includes(page);
  if (waFab) waFab.style.display = showWa ? 'flex' : 'none';

  // Synchroniser l'état actif de TOUTES les barres de navigation
  document.querySelectorAll('.nav-item').forEach(btn => {
    const isTarget = btn.getAttribute('onclick')?.includes(`'${page}'`);
    if (isTarget) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  if (page === 'shop') renderProducts();
  if (page === 'cart') renderCart();
  if (page === 'checkout') renderCheckout();
  if (page === 'tracking') renderTracking();
  updateBadges();
}

// ─── Products ─────────────────────────────────
function getBadgeHTML(b) {
  if (!b) return '';
  const l = { fire: '🔥 Best-seller', new: '✨ Nouveau', promo: '🎁 Promo' };
  const c = { fire: 'badge-fire', new: 'badge-new', promo: 'badge-promo' };
  return `<span class="badge ${c[b]}">${l[b]}</span>`;
}

function renderProducts() {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const filtered = products.filter(p => {
    const cat = activeCategory === 'all' || p.category === activeCategory;
    const s = p.name.toLowerCase().includes(search) || p.subtitle.toLowerCase().includes(search);
    return cat && s;
  });
  grid.innerHTML = filtered.map((p, i) => `
    <div class="product-card" onclick="openDetail(${p.id})" role="listitem" style="animation: scaleIn 0.4s ${i * 0.06}s both;">
      <div class="card-image">
        ${getBadgeHTML(p.badge)}
        <img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" loading="lazy" decoding="async"/>
      </div>
      <div class="card-body">
        <h4>${escapeHTML(p.name)}</h4>
        <p class="subtitle">${escapeHTML(p.subtitle)}</p>
        <div class="rating-row">
          <span class="material-symbols-outlined star" style="font-variation-settings:'FILL' 1;" aria-hidden="true">star</span>
          <span style="font-weight:700;">${p.rating}</span>
          <span style="color:var(--text-muted);">•</span>
          <span style="color:var(--text-tertiary);">${p.orders} vendus</span>
        </div>
        <div class="price-row">
          <span class="price">${p.price.toLocaleString()} <span>FCFA</span></span>
          <button onclick="event.stopPropagation(); quickAdd(${p.id}, event)" class="add-btn" aria-label="Ajouter au panier">
            <span class="material-symbols-outlined" style="font-size:20px;" aria-hidden="true">add</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterProducts() { renderProducts(); }
function filterCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-btn').forEach(btn => {
    const m = btn.dataset.cat === cat;
    btn.setAttribute('aria-selected', m);
    btn.classList.toggle('active', m);
  });
  renderProducts();
}

function quickAdd(id, event) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const ex = cart.find(c => c.id === id && !c.accomp);
  if (ex) ex.qty += 1; else cart.push({ ...p, qty: 1, accomp: null });
  updateBadges();
  showToast(`${p.name} ajouté au panier 🛒`);
  if (event) animateAddToCart(event, p.image);
}

function animateAddToCart(event, imgSrc) {
  if (!event || !imgSrc) return;
  const btn = event.currentTarget || event.target;
  const card = btn.closest('.product-card');
  const imgEl = card ? card.querySelector('img') : null;
  const startRect = imgEl ? imgEl.getBoundingClientRect() : btn.getBoundingClientRect();

  let targetIcon = document.getElementById('cart-badge-shop');
  if (window.innerWidth < 768) {
    targetIcon = document.getElementById('cart-badge-nav');
  }
  const targetRect = targetIcon.getBoundingClientRect();
  
  const flyingImg = document.createElement('img');
  flyingImg.src = imgSrc;
  flyingImg.className = 'fly-to-cart';
  flyingImg.style.left = startRect.left + 'px';
  flyingImg.style.top = startRect.top + 'px';
  flyingImg.style.width = startRect.width + 'px';
  flyingImg.style.height = startRect.height + 'px';
  
  document.body.appendChild(flyingImg);
  
  requestAnimationFrame(() => {
    flyingImg.style.left = targetRect.left + 'px';
    flyingImg.style.top = targetRect.top + 'px';
    flyingImg.style.width = '20px';
    flyingImg.style.height = '20px';
    flyingImg.style.opacity = '0.4';
    flyingImg.style.transform = 'scale(0.2)';
  });
  
  setTimeout(() => {
    flyingImg.remove();
    const iconBtn = targetIcon.parentElement;
    if (iconBtn) {
      iconBtn.style.animation = 'bounceIn 0.4s';
      setTimeout(() => { iconBtn.style.animation = ''; }, 400);
    }
  }, 600);
}

// ─── Detail + Accompagnement ──────────────────
function openDetail(id) {
  currentProduct = products.find(p => p.id === id);
  if (!currentProduct) return;
  detailQty = 1;
  selectedAccomp = [];

  document.getElementById('detail-image').src = currentProduct.image;
  document.getElementById('detail-image').alt = currentProduct.name;
  document.getElementById('detail-name').textContent = currentProduct.name;
  document.getElementById('detail-rating').textContent = currentProduct.rating;
  document.getElementById('detail-price').textContent = currentProduct.price.toLocaleString() + ' FCFA';
  document.getElementById('detail-desc').textContent = currentProduct.desc;
  document.getElementById('detail-orders-text').textContent = `${currentProduct.orders} commandés aujourd'hui`;
  document.getElementById('detail-qty').textContent = '1';
  
  const detailNote = document.getElementById('detail-note');
  if (detailNote) detailNote.value = '';

  const accompSection = document.getElementById('accomp-section');
  const isMainDish = !['accompagnements', 'boissons'].includes(currentProduct.category);
  accompSection.style.display = isMainDish ? 'block' : 'none';

  if (isMainDish) {
    const grid = document.getElementById('accomp-grid');
    grid.innerHTML = accompagnements.map(a => `
      <div class="accomp-card" onclick="selectAccomp(${a.id}, this)" id="accomp-${a.id}">
        <div style="width:100%;height:85px;position:relative;">
          <img src="${escapeHTML(a.image)}" alt="${escapeHTML(a.name)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" decoding="async"/>
        </div>
        <div style="padding:12px;text-align:center;display:flex;flex-direction:column;gap:4px;">
          <span style="font-weight:800;font-size:14px;color:var(--text-primary);line-height:1.2;">${escapeHTML(a.name)}</span>
          <span style="font-size:13px;font-weight:700;color:var(--accent);">+${a.price.toLocaleString()} FCFA</span>
        </div>
        <div class="check-icon" style="position:absolute;top:8px;right:8px;width:26px;height:26px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.2);">
          <span class="material-symbols-outlined" style="font-size:18px;color:white;font-weight:bold;">check</span>
        </div>
      </div>
    `).join('');
  }

  navigateTo('detail');
}

function selectAccomp(id, el) {
  const index = selectedAccomp.indexOf(id);
  if (index > -1) { 
    selectedAccomp.splice(index, 1); 
    el.classList.remove('selected'); 
  } else {
    selectedAccomp.push(id);
    el.classList.add('selected');
  }
}

function changeDetailQty(d) {
  detailQty = Math.max(1, detailQty + d);
  document.getElementById('detail-qty').textContent = detailQty;
}

function goToCheckout() {
  if (!currentProduct) return;
  const orderNote = document.getElementById('detail-note')?.value.trim() || '';
  const noteHash = orderNote ? '-' + btoa(unescape(encodeURIComponent(orderNote))).substring(0,8) : '';
  const accKey = selectedAccomp.length > 0 ? selectedAccomp.slice().sort().join(',') : 'solo';
  const cartKey = currentProduct.id + '-' + accKey + noteHash;
  const existing = cart.find(c => c.cartKey === cartKey);
  
  const accompItems = selectedAccomp.map(id => {
    const a = accompagnements.find(x => x.id === id);
    return { name: a.name, price: a.price, image: a.image };
  });

  const accompTotal = accompItems.reduce((sum, a) => sum + a.price, 0);

  if (existing) {
    existing.qty += detailQty;
  } else {
    cart.push({
      ...currentProduct, cartKey, qty: detailQty,
      accompons: accompItems,
      note: orderNote,
      totalPrice: currentProduct.price + accompTotal
    });
  }

  updateBadges();
  showToast(`${currentProduct.name} ajouté! 🛒`);
  navigateTo('checkout');
}

// ─── Cart ─────────────────────────────────────
function renderCart() {
  const container = document.getElementById('cart-items-container');
  const emptyEl = document.getElementById('cart-empty');
  const summaryEl = document.getElementById('cart-summary');
  if (!container) return;
  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  document.getElementById('cart-count-label').textContent = `(${totalItems} article${totalItems > 1 ? 's' : ''})`;

  if (cart.length === 0) {
    container.innerHTML = ''; emptyEl.style.display = 'flex';
    if (summaryEl) summaryEl.style.display = 'none'; return;
  }
  emptyEl.style.display = 'none';
  if (summaryEl) summaryEl.style.display = 'block';

  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item" role="listitem" style="animation: slideUp 0.4s ${idx * 0.08}s both;">
      <div style="width:56px;height:56px;border-radius:var(--radius-sm);overflow:hidden;flex-shrink:0;">
        <img alt="${escapeHTML(item.name)}" style="width:100%;height:100%;object-fit:cover;" src="${escapeHTML(item.image)}" loading="lazy"/>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:start;">
          <div style="min-width:0;">
            <h3 style="font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(item.name)}</h3>
            ${item.accompons && item.accompons.length > 0 ? item.accompons.map(a => `<p style="font-size:11px;color:var(--accent);font-weight:600;margin-top:2px;">+ ${escapeHTML(a.name)}</p>`).join('') : ''}
            ${item.note ? `<p style="font-size:11px;color:var(--text-tertiary);margin-top:4px;font-style:italic;">"${escapeHTML(item.note)}"</p>` : ''}
          </div>
          <button onclick="removeFromCart(${idx})" style="color:var(--error);padding:4px;flex-shrink:0;transition:transform 0.15s;" onmouseenter="this.style.transform='scale(1.1)'" onmouseleave="this.style.transform='scale(1)'" aria-label="Supprimer">
            <span class="material-symbols-outlined" style="font-size:18px;" aria-hidden="true">delete</span>
          </button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <span style="font-family:Outfit;font-size:15px;font-weight:800;color:var(--accent);">${((item.totalPrice || item.price) * item.qty).toLocaleString()} F</span>
          <div class="qty-selector">
            <button onclick="changeCartQty(${idx}, -1)" class="qty-btn"><span class="material-symbols-outlined" style="font-size:16px;">remove</span></button>
            <span class="qty-count">${item.qty}</span>
            <button onclick="changeCartQty(${idx}, 1)" class="qty-btn add"><span class="material-symbols-outlined" style="font-size:16px;">add</span></button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
  updateCartTotals();
}

function changeCartQty(idx, d) { cart[idx].qty += d; if (cart[idx].qty <= 0) cart.splice(idx, 1); renderCart(); updateBadges(); }
function removeFromCart(idx) { const n = cart[idx].name; cart.splice(idx, 1); renderCart(); updateBadges(); showToast(`${n} retiré`); }
function updateCartTotals() {
  const sub = cart.reduce((s, c) => s + (c.totalPrice || c.price) * c.qty, 0);
  document.getElementById('cart-subtotal').textContent = sub.toLocaleString() + ' FCFA';
  document.getElementById('cart-total').textContent = (sub + 500).toLocaleString() + ' FCFA';
}

// ─── User Info Caching ─────────────────────────
function saveUserInfo() {
  const info = {
    name: document.getElementById('cust-name')?.value || '',
    phone: document.getElementById('cust-phone')?.value || '',
    commune: document.getElementById('cust-commune')?.value || '',
    quartier: document.getElementById('cust-quartier')?.value || '',
    details: document.getElementById('cust-details')?.value || ''
  };
  localStorage.setItem('chariow_user_info', JSON.stringify(info));
}

function restoreUserInfo() {
  try {
    const info = JSON.parse(localStorage.getItem('chariow_user_info'));
    if (!info) return;
    if (info.name) document.getElementById('cust-name').value = info.name;
    if (info.phone) document.getElementById('cust-phone').value = info.phone;
    if (info.commune) {
      document.getElementById('cust-commune').value = info.commune;
      updateQuartiers();
      if (info.quartier) document.getElementById('cust-quartier').value = info.quartier;
    }
    if (info.details) document.getElementById('cust-details').value = info.details;
  } catch(e) {}
}

// ─── Checkout ─────────────────────────────────
function renderCheckout() {
  const container = document.getElementById('checkout-items');
  if (!container) return;
  restoreUserInfo();
  container.innerHTML = cart.map(item => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:44px;height:44px;border-radius:var(--radius-sm);overflow:hidden;"><img alt="${escapeHTML(item.name)}" style="width:100%;height:100%;object-fit:cover;" src="${escapeHTML(item.image)}" loading="lazy"/></div>
        <div>
          <p style="font-weight:700;font-size:13px;">${escapeHTML(item.name)} × ${item.qty}</p>
          ${item.accompons && item.accompons.length > 0 ? item.accompons.map(acc => `<p style="font-size:11px;color:var(--accent);margin-top:2px;">+ ${escapeHTML(acc.name)}</p>`).join('') : ''}
          ${item.note ? `<p style="font-size:11px;color:var(--text-tertiary);margin-top:4px;font-style:italic;">"${escapeHTML(item.note)}"</p>` : ''}
        </div>
      </div>
      <p style="font-weight:700;font-size:13px;color:var(--text-secondary);">${((item.totalPrice || item.price) * item.qty).toLocaleString()} F</p>
    </div>
  `).join('');
  const sub = cart.reduce((s, c) => s + (c.totalPrice || c.price) * c.qty, 0);
  document.getElementById('checkout-total').textContent = (sub + 500).toLocaleString() + ' FCFA';
}

// ─── Location Data ───────────────────────────
const quartiersAbidjan = {
  "Abobo": ["Docui", "Gare", "Kennedy", "PK18", "Avocatier", "Samaké", "Baoli", "Akeikoi", "Sagbé", "Té", "Autre"],
  "Adjamé": ["220 Logements", "Bracodi", "Dallas", "Habitat", "Macaci", "Marie Thérèse", "Mirador", "Renault", "Williamsville", "Autre"],
  "Attécoubé": ["Agban", "Boribana", "Cité Fairmont", "Jérusalem", "Locodjro", "Santé", "Abobodoumé", "Autre"],
  "Bingerville": ["Akandjé", "Cité Sipim", "Marché", "Cité CIE", "Bregbo", "Gbagba", "Féh Kessé", "Autre"],
  "Cocody": ["2 Plateaux", "Angré", "Blockhauss", "Cocody Centre", "Danga", "Riviera 2", "Riviera 3", "Riviera 4 / M'Badon", "Riviera Palmeraie", "Riviera Faya", "Attoban", "Autre"],
  "Koumassi": ["Remblais", "Sicogi", "Sopim", "Progrès", "Divo", "Soweto", "Poto-Poto", "Bia-Sud", "Campement", "Autre"],
  "Marcory": ["Zone 4", "Bietry", "Marcory Centre", "Remblais", "Sicogi", "Résidentiel", "Aliodan", "Tsf", "Autre"],
  "Plateau": ["Cité Esculape", "Indénié", "Sorbonne", "Le Commerce", "Autre"],
  "Port-Bouët": ["Vridi", "Gonzagueville", "Jean Folly", "Adjouffou", "Terre Rouge", "Phare", "Aéroport", "Autre"],
  "Treichville": ["Arras", "Avenue 8", "Belleville", "Biafra", "Gare de Bassam", "Sicogi", "Zone 3", "Autre"],
  "Yopougon": ["Andokoi", "Banco", "Bae", "Gesco", "Kouté", "Maroc", "Niangon", "Nouveau Quartier", "Port-Bouët 2", "Selmer", "Sicogi", "Toits Rouges", "Wassakara", "Autre"]
};

function updateQuartiers() {
  const commune = document.getElementById("cust-commune").value;
  const quartierSelect = document.getElementById("cust-quartier");
  
  if (commune && quartiersAbidjan[commune]) {
    quartierSelect.innerHTML = `<option value="" disabled selected>Sélectionnez votre quartier</option>`;
    quartiersAbidjan[commune].forEach(q => {
      quartierSelect.innerHTML += `<option value="${q}">${q}</option>`;
    });
    quartierSelect.disabled = false;
  } else {
    quartierSelect.innerHTML = `<option value="" disabled selected>Sélectionnez d'abord la commune</option>`;
    quartierSelect.disabled = true;
  }
}

// ─── Place Order ──────────────────────────────
function placeOrder() {
  if (cart.length === 0) { showToast('Votre panier est vide!'); return; }
  const name = document.getElementById('cust-name')?.value?.trim();
  const phone = document.getElementById('cust-phone')?.value?.trim();
  const commune = document.getElementById('cust-commune')?.value?.trim();
  const quartierSelect = document.getElementById('cust-quartier')?.value?.trim();
  const details = document.getElementById('cust-details')?.value?.trim() || '';

  if (!name) { showToast('Veuillez entrer votre nom'); document.getElementById('cust-name')?.focus(); return; }
  if (!phone || phone.length < 8) { showToast('Veuillez entrer un numéro valide'); document.getElementById('cust-phone')?.focus(); return; }
  if (!commune) { showToast('Veuillez sélectionner la commune'); document.getElementById('cust-commune')?.focus(); return; }
  if (!quartierSelect) { showToast('Veuillez sélectionner le quartier'); document.getElementById('cust-quartier')?.focus(); return; }
  
  const fullLocation = `${commune} - ${quartierSelect}`;

  const paymentEl = document.querySelector('input[name="payment"]:checked');
  const paymentLabels = { wave: 'Wave', orange_money: 'Orange Money', cash: 'Espèces' };
  const payment = paymentEl ? paymentLabels[paymentEl.value] || paymentEl.value : 'Non précisé';

  const subtotal = cart.reduce((s, c) => s + (c.totalPrice || c.price) * c.qty, 0);
  const total = subtotal + 500;
  const orderId = 'CMD-' + Date.now().toString(36).toUpperCase();

  const orderData = {
    id: orderId, status: 'en_attente',
    client: { name, phone, quartier: fullLocation, details }, payment,
    items: cart.map(item => ({ name: item.name, image: item.image, price: item.price, totalPrice: item.totalPrice || item.price, qty: item.qty, accompons: item.accompons || [], note: item.note || '' })),
    subtotal, service_fee: 500, total
  };

  saveUserInfo();

  const btn = window.event ? window.event.currentTarget : null;
  if (btn) btn.disabled = true;

  (async () => {
    if (!supabase) {
      showToast("Erreur: Supabase n'est pas initialisé. Vérifiez votre connexion.");
      if (btn) btn.disabled = false;
      return;
    }

    try {
      const { error } = await supabase.from('orders').insert([orderData]);
      if (error) throw error;

      let myOrders = [];
      try { myOrders = JSON.parse(localStorage.getItem('chariow_my_orders') || '[]'); } catch(e) {}
      myOrders.unshift(orderId);
      localStorage.setItem('chariow_my_orders', JSON.stringify(myOrders));

      document.getElementById('success-order-id').textContent = orderId;
      document.getElementById('success-total').textContent = total.toLocaleString() + ' FCFA';

      cart = [];
      updateBadges();
      localStorage.removeItem('chariow_cart');

      showToast('Commande enregistrée! ✅');
      celebrate();
      navigateTo('success');
    } catch (err) {
      console.error('Erreur commande:', err);
      showToast('Erreur lors de la validation.');
    } finally {
      if (btn) btn.disabled = false;
    }
  })();
}

// ─── Badges ───────────────────────────────────
function updateBadges() {
  localStorage.setItem('chariow_cart', JSON.stringify(cart));
  const total = cart.reduce((s, c) => s + c.qty, 0);
  ['cart-badge-shop', 'cart-badge-nav', 'cart-badge-detail', 'cart-badge-nav2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = total; el.style.display = total === 0 ? 'none' : 'flex'; }
  });
}

// ─── Toast ────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  const tText = document.getElementById('toast-text'); if(tText) tText.textContent = msg;
  t.classList.add('show');
  t.style.animation = 'islandPulse 0.3s ease';
  setTimeout(() => { t.style.animation = ''; }, 300);
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Init ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Always hide splashscreen after a delay
  setTimeout(() => {
    const s = document.getElementById('splashscreen');
    if (s) { s.classList.add('hide'); setTimeout(() => s.remove(), 600); }
  }, 2000);

  try {
    updateBadges();
    navigateTo('welcome');
    startPromoTimer();
  } catch (e) {
    console.error("Init Error:", e);
  }
});

// ─── Cinematic Button Particles ──────────────────
function explodeButton(btn) {
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const type = btn.dataset.type || 'particles';
  const color = btn.dataset.color || '#ff6b35';
  if (type === 'particles') spawnParticles(cx, cy, color);
  else if (type === 'confetti') spawnConfetti(cx, cy);
}
function spawnParticles(cx, cy, color) {
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div'); p.className = 'particle';
    p.style.background = color; p.style.left = cx + 'px'; p.style.top = cy + 'px';
    document.body.appendChild(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 80;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 40;
    setTimeout(() => { p.style.transform = `translate(${dx}px, ${dy}px) scale(0)`; p.style.opacity = '0'; }, 10);
    setTimeout(() => p.remove(), 700);
  }
}
function spawnConfetti(cx, cy) {
  const colors = ['#ff6b35', '#ff8c5a', '#fbbf24', '#8b5cf6', '#06b6d4', '#22c55e'];
  for (let i = 0; i < 40; i++) {
    const c = document.createElement('div'); 
    c.className = 'confetti';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.left = cx + 'px'; 
    c.style.top = cy + 'px';
    c.style.width = Math.random() * 8 + 4 + 'px';
    c.style.height = Math.random() * 8 + 4 + 'px';
    document.body.appendChild(c);
    
    const angle = Math.random() * Math.PI * 2;
    const velocity = 5 + Math.random() * 15;
    const dx = Math.cos(angle) * velocity * 10;
    const dy = Math.sin(angle) * velocity * 10 - 100;
    const rot = Math.random() * 720;
    
    setTimeout(() => { 
      c.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(0)`; 
      c.style.opacity = '0'; 
    }, 10);
    setTimeout(() => c.remove(), 1200);
  }
}

// Celebration plein écran (Style MagicUI)
function celebrate() {
  const duration = 3000;
  const end = Date.now() + duration;
  
  const interval = setInterval(() => {
    if (Date.now() > end) return clearInterval(interval);
    
    // Explosion à gauche
    spawnConfetti(0, window.innerHeight * 0.7);
    // Explosion à droite
    spawnConfetti(window.innerWidth, window.innerHeight * 0.7);
    // Explosion au centre
    if (Math.random() > 0.5) {
      spawnConfetti(window.innerWidth / 2, window.innerHeight * 0.5);
    }
  }, 200);
}

// ─── Service Worker Registration ──────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}
