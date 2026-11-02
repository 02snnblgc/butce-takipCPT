import './styles.css';
import { DB } from './services/db.js';
import { createLocalProfile, verifyLocalPassword } from './services/auth.js';
import { DEFAULT_CATEGORIES, categoriesFor } from './services/categories.js';
import { money, monthKey, currentPeriod, periodLabel, dateLabel, escapeHTML, id, movePeriod, totals, downloadBlob } from './services/utils.js';
import { requestNotificationPermission, openExactAlarmSettings, setupNotificationActions, scheduleReminder, cancelReminder, syncAllReminders } from './services/notifications.js';
import { exportExcel, exportPDF } from './services/reports.js';
import { exportFile } from './services/file-export.js';

const app = document.querySelector('#app');
const THEMES = [
  { id: 'light', name: 'Açık', color: '#edf3fb' },
  { id: 'dark', name: 'Koyu', color: '#202632' },
  { id: 'mint', name: 'Mint', color: '#e2f2eb' },
  { id: 'lavender', name: 'Lavanta', color: '#eee8fa' },
  { id: 'peach', name: 'Şeftali', color: '#fae9df' },
  { id: 'sky', name: 'Gökyüzü', color: '#e3f0fa' },
  { id: 'rose', name: 'Gül', color: '#f7e7ed' }
];

const state = {
  period: currentPeriod(),
  page: 'home',
  items: [],
  profile: null,
  customCategories: { income: [], expense: [] },
  theme: 'light',
  search: '',
  listFilter: 'all',
  compareFrom: movePeriod(currentPeriod(), -1),
  compareTo: currentPeriod()
};

const byId = id => document.getElementById(id);
const notify = message => {
  const toast = byId('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('show'), 2800);
};

function avatarMarkup(profile, size = 'normal') {
  if (profile?.avatar) return `<img class="avatar ${size}" src="${profile.avatar}" alt="Profil fotoğrafı">`;
  const initials = (profile?.name || 'BT').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('tr-TR');
  return `<div class="avatar avatar-fallback ${size}">${escapeHTML(initials || 'BT')}</div>`;
}

function setTheme(theme) {
  state.theme = THEMES.some(x => x.id === theme) ? theme : 'light';
  document.documentElement.dataset.theme = state.theme;
  DB.setSetting('theme', state.theme).catch(console.error);
}

function renderAuth(mode = 'login', error = '') {
  const register = mode === 'register';
  app.innerHTML = `
    <main class="auth-screen">
      <div class="auth-brand"><div class="brand-mark">₺</div><div><h1>Bütçe Takip</h1><p>Kişisel finans kontrolünüz</p></div></div>
      <section class="auth-card">
        <span class="eyebrow">${register ? 'İLK KURULUM' : 'HOŞ GELDİNİZ'}</span>
        <h2>${register ? 'Hesabınızı oluşturun' : 'Hesabınıza giriş yapın'}</h2>
        <p class="muted">${register ? 'Profiliniz ve verileriniz bu cihazda saklanır.' : 'Yerel hesabınıza erişmek için parolanızı girin.'}</p>
        ${error ? `<div class="error-box">${escapeHTML(error)}</div>` : ''}
        <form id="auth-form" class="form-stack">
          ${register ? `
            <label>Ad Soyad<input name="name" required autocomplete="name" placeholder="Adınız Soyadınız"></label>
            <label>E-posta<input name="email" type="email" autocomplete="email" placeholder="ornek@eposta.com"></label>
            <label>Profil fotoğrafı <span class="optional">(isteğe bağlı)</span><input name="avatar" type="file" accept="image/*"></label>
          ` : ''}
          <label>Parola<input name="password" type="password" required minlength="8" autocomplete="${register ? 'new-password' : 'current-password'}" placeholder="En az 8 karakter"></label>
          ${register ? '<label>Parola tekrar<input name="password2" type="password" required minlength="8" autocomplete="new-password" placeholder="Parolanızı tekrar yazın"></label>' : ''}
          <button class="btn btn-primary btn-wide" type="submit">${register ? 'Hesap oluştur' : 'Giriş yap'}</button>
        </form>
        <p class="auth-footnote">Bu başlangıç sürümü çevrimdışı ve tek cihaz/tek profil kullanımı içindir. Bulut hesabı veya cihazlar arası eşitleme içermez.</p>
      </section>
    </main>`;
  byId('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    try {
      if (register) {
        if (password !== form.get('password2')) throw new Error('Parolalar birbiriyle eşleşmiyor.');
        const file = form.get('avatar');
        let avatar = '';
        if (file instanceof File && file.size) {
          if (file.size > 2 * 1024 * 1024) throw new Error('Profil fotoğrafı en fazla 2 MB olabilir.');
          avatar = await readFileAsDataURL(file);
        }
        const profile = await createLocalProfile({ name: String(form.get('name') || ''), email: String(form.get('email') || ''), password, avatar });
        await DB.setSetting('profile', profile);
        await DB.setSetting('customCategories', { income: [], expense: [] });
        await DB.setSetting('reminders', { reminderDays: 1, reminderTime: '09:00' });
        await DB.setSetting('theme', 'light');
        state.profile = profile;
        await enterApp();
      } else {
        const profile = await DB.getSetting('profile');
        if (!profile || !(await verifyLocalPassword(password, profile))) throw new Error('Parola hatalı. Tekrar deneyin.');
        state.profile = profile;
        await enterApp();
      }
    } catch (error) {
      renderAuth(register ? 'register' : 'login', error.message || 'İşlem tamamlanamadı.');
    }
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

async function enterApp() {
  state.items = await DB.allTransactions();
  state.customCategories = await DB.getSetting('customCategories', { income: [], expense: [] });
  setTheme(await DB.getSetting('theme', 'light'));
  await ensureRecurringOccurrences();
  state.items = await DB.allTransactions();
  renderShell();
  await syncAllReminders();
}

function renderShell() {
  app.innerHTML = `
    <div class="app-shell" id="main-shell">
      <header class="topbar">
        <div class="brand-lockup"><div class="brand-mark small">₺</div><div><strong>Bütçe Takip</strong><small>Kişisel finans</small></div></div>
        <button class="profile-chip" data-page="settings" aria-label="Profil ve ayarlar">${avatarMarkup(state.profile, 'small')}<span>${escapeHTML(state.profile?.name || '')}</span><span class="chevron">⌄</span></button>
      </header>
      <main id="page-content" class="page-content"></main>
      <nav class="bottom-nav" aria-label="Ana menü">
        <button data-page="home" class="nav-item"><span>⌂</span><small>Özet</small></button>
        <button data-page="transactions" class="nav-item"><span>↕</span><small>Kayıtlar</small></button>
        <button data-page="compare" class="nav-item"><span>▥</span><small>Karşılaştır</small></button>
        <button data-page="settings" class="nav-item"><span>⚙</span><small>Ayarlar</small></button>
      </nav>
    </div>
    <div id="dialog-host"></div><div id="toast" class="toast" role="status"></div>`;
  renderPage();
}

function periodHeader() {
  return `<div class="period-switcher">
    <button class="icon-button" data-action="period-prev" aria-label="Önceki ay">‹</button>
    <div class="period-title"><strong>${escapeHTML(periodLabel(state.period))}</strong><small>Harcama dönemi</small></div>
    <button class="icon-button" data-action="period-next" aria-label="Sonraki ay">›</button>
  </div>`;
}

function statCard(label, value, tone, symbol) {
  return `<article class="stat-card ${tone}"><div class="stat-top"><span>${label}</span><b>${symbol}</b></div><strong>${money(value)}</strong></article>`;
}

function renderHome() {
  const items = state.items.filter(item => item.period === state.period);
  const sum = totals(items);
  const pending = items.filter(item => item.type === 'expense' && item.status !== 'paid').sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const max = Math.max(sum.income, sum.expense, 1);
  const notePromise = DB.getPeriodNote(state.period);
  byId('page-content').innerHTML = `
    <section class="page-heading"><div><span class="eyebrow">GENEL BAKIŞ</span><h1>Finans özeti</h1><p class="muted">Gelir ve giderlerinizi tek ekranda izleyin.</p></div><button class="btn btn-primary" data-action="add-entry">＋ Kayıt ekle</button></section>
    ${periodHeader()}
    <section class="stats-grid">
      ${statCard('Toplam gelir', sum.income, 'income', '↗')}
      ${statCard('Toplam gider', sum.expense, 'expense', '↘')}
      ${statCard('Kalan bakiye', sum.balance, 'balance', '₺')}
    </section>
    <section class="content-card"><div class="section-title"><div><h2>Dönem dağılımı</h2><p class="muted">${items.length} kayıt</p></div><span class="pill ${sum.balance >= 0 ? 'pill-green' : 'pill-red'}">${sum.balance >= 0 ? 'Pozitif bakiye' : 'Bütçe açığı'}</span></div>
      <div class="bar-row"><div><span>Gelir</span><b>${money(sum.income)}</b></div><div class="meter"><i class="meter-income" style="width:${Math.max(0, Math.min(100, sum.income / max * 100))}%"></i></div></div>
      <div class="bar-row"><div><span>Gider</span><b>${money(sum.expense)}</b></div><div class="meter"><i class="meter-expense" style="width:${Math.max(0, Math.min(100, sum.expense / max * 100))}%"></i></div></div>
      <div class="mini-totals"><div><small>Ödenen gider</small><strong>${money(sum.paid)}</strong></div><div><small>Bekleyen gider</small><strong>${money(sum.unpaid)}</strong></div></div>
    </section>
    <section class="content-card"><div class="section-title"><div><h2>Yaklaşan ödemeler</h2><p class="muted">Bu dönemde henüz ödenmeyen giderler</p></div><button class="text-button" data-page="transactions">Tümünü gör</button></div>
      ${pending.length ? `<div class="payment-list">${pending.slice(0, 5).map(item => paymentRow(item)).join('')}</div>` : '<div class="empty-state compact"><span>✓</span><p>Bu dönemde bekleyen ödeme yok.</p></div>'}
    </section>
    <section class="content-card"><div class="section-title"><div><h2>Dönem notu</h2><p class="muted">Bu aya özel hatırlatmalarınız</p></div><span class="note-icon">✎</span></div>
      <textarea id="period-note" class="period-note" rows="3" placeholder="Bu ay için notlarınızı buraya yazın…"></textarea><div class="note-save-row"><small id="note-save-status" class="muted">Otomatik kaydedilir</small></div>
    </section>`;
  notePromise.then(note => { const field = byId('period-note'); if (field) field.value = note; });
}

function paymentRow(item) {
  const overdue = item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10);
  return `<div class="payment-row"><div class="payment-symbol">${item.category.includes('Fatur') ? '▤' : '₺'}</div><div class="payment-main"><strong>${escapeHTML(item.category)}</strong><small>${item.dueDate ? `${overdue ? 'Gecikmiş · ' : 'Son ödeme · '}${dateLabel(item.dueDate)}` : 'Son ödeme tarihi girilmedi'}</small></div><div class="payment-end"><b>${money(item.amount)}</b><span class="pill ${overdue ? 'pill-red' : 'pill-amber'}">${overdue ? 'Gecikmiş' : 'Bekliyor'}</span></div></div>`;
}

function renderTransactions() {
  byId('page-content').innerHTML = `
    <section class="page-heading"><div><span class="eyebrow">HAREKETLER</span><h1>Gelir ve giderler</h1><p class="muted">Kayıt ekleyin, arayın ve düzenleyin.</p></div><button class="btn btn-primary" data-action="add-entry">＋ Yeni kayıt</button></section>
    ${periodHeader()}
    <section class="content-card list-tools">
      <div class="search-wrap"><span>⌕</span><input id="transaction-search" type="search" value="${escapeHTML(state.search)}" placeholder="Kategori, tutar, not veya tarih ara…"></div>
      <div class="filter-chips"><button class="filter-chip ${state.listFilter === 'all' ? 'active' : ''}" data-filter="all">Tümü</button><button class="filter-chip ${state.listFilter === 'income' ? 'active' : ''}" data-filter="income">Gelir</button><button class="filter-chip ${state.listFilter === 'expense' ? 'active' : ''}" data-filter="expense">Gider</button><button class="filter-chip ${state.listFilter === 'pending' ? 'active' : ''}" data-filter="pending">Bekleyen</button></div>
      <div id="transaction-list"></div>
    </section>`;
  renderTransactionList();
}

function renderTransactionList() {
  const host = byId('transaction-list');
  if (!host) return;
  const query = state.search.trim().toLocaleLowerCase('tr-TR');
  let rows = state.items.filter(item => {
    if (!query && item.period !== state.period) return false;
    if (query) {
      const haystack = [item.category, item.note, item.dueDate, item.period, item.amount, item.type].join(' ').toLocaleLowerCase('tr-TR');
      if (!haystack.includes(query)) return false;
    }
    if (state.listFilter === 'income' && item.type !== 'income') return false;
    if (state.listFilter === 'expense' && item.type !== 'expense') return false;
    if (state.listFilter === 'pending' && item.status === 'paid') return false;
    return true;
  }).sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '') || b.updatedAt.localeCompare(a.updatedAt));
  host.innerHTML = rows.length ? `<div class="transaction-list">${rows.map(item => transactionCard(item)).join('')}</div>` : `<div class="empty-state"><span>⌕</span><strong>Kayıt bulunamadı</strong><p>Arama ölçütlerini değiştirin veya yeni kayıt ekleyin.</p></div>`;
}

function transactionCard(item) {
  const income = item.type === 'income';
  const statusText = item.status === 'paid' ? (income ? 'Alındı' : 'Ödendi') : (income ? 'Bekleniyor' : 'Ödenmedi');
  return `<article class="transaction-card">
    <div class="transaction-icon ${income ? 'income-icon' : 'expense-icon'}">${income ? '↗' : '↘'}</div>
    <div class="transaction-info"><strong>${escapeHTML(item.category)}</strong><small>${escapeHTML(periodLabel(item.period))}${item.dueDate ? ` · ${dateLabel(item.dueDate)}` : ''}</small>${item.note ? `<small class="transaction-note">${escapeHTML(item.note)}</small>` : ''}<span class="pill ${item.status === 'paid' ? 'pill-green' : 'pill-amber'}">${statusText}</span></div>
    <div class="transaction-actions"><b class="${income ? 'income-text' : 'expense-text'}">${income ? '+' : '−'}${money(item.amount)}</b><div><button class="tiny-action" data-action="toggle-status" data-id="${escapeHTML(item.id)}" title="Durumu değiştir">✓</button><button class="tiny-action" data-action="edit-entry" data-id="${escapeHTML(item.id)}" title="Düzenle">✎</button><button class="tiny-action danger-action" data-action="delete-entry" data-id="${escapeHTML(item.id)}" title="Sil">×</button></div></div>
  </article>`;
}

function renderCompare() {
  const a = totals(state.items.filter(item => item.period === state.compareFrom));
  const b = totals(state.items.filter(item => item.period === state.compareTo));
  const delta = b.balance - a.balance;
  byId('page-content').innerHTML = `
    <section class="page-heading"><div><span class="eyebrow">ANALİZ</span><h1>Dönem karşılaştırma</h1><p class="muted">İki farklı ayın bütçesini yan yana inceleyin.</p></div></section>
    <section class="content-card compare-selectors"><label>Birinci dönem<input type="month" id="compare-from" value="${state.compareFrom}"></label><span class="compare-vs">VS</span><label>İkinci dönem<input type="month" id="compare-to" value="${state.compareTo}"></label></section>
    <div class="compare-grid">${compareCard(state.compareFrom, a)}${compareCard(state.compareTo, b)}</div>
    <section class="content-card"><div class="section-title"><div><h2>Net bakiye farkı</h2><p class="muted">İkinci dönem eksi birinci dönem</p></div></div><strong class="compare-delta ${delta >= 0 ? 'income-text' : 'expense-text'}">${delta > 0 ? '+' : ''}${money(delta)}</strong><p class="muted">${delta >= 0 ? 'İkinci dönemin net bakiyesi daha yüksek.' : 'İkinci dönemin net bakiyesi daha düşük.'}</p>
      <div class="compare-bars"><div><small>${escapeHTML(periodLabel(state.compareFrom))}</small><div class="meter"><i class="meter-income" style="width:${Math.max(0, Math.min(100, a.income / Math.max(a.income, b.income, 1) * 100))}%"></i></div><div class="meter"><i class="meter-expense" style="width:${Math.max(0, Math.min(100, a.expense / Math.max(a.expense, b.expense, 1) * 100))}%"></i></div></div><div><small>${escapeHTML(periodLabel(state.compareTo))}</small><div class="meter"><i class="meter-income" style="width:${Math.max(0, Math.min(100, b.income / Math.max(a.income, b.income, 1) * 100))}%"></i></div><div class="meter"><i class="meter-expense" style="width:${Math.max(0, Math.min(100, b.expense / Math.max(a.expense, b.expense, 1) * 100))}%"></i></div></div><div class="legend"><span><i class="legend-dot green"></i>Gelir</span><span><i class="legend-dot red"></i>Gider</span></div></div>
    </section>`;
}

function compareCard(period, sum) {
  return `<article class="content-card compare-card"><span class="eyebrow">${escapeHTML(periodLabel(period))}</span><strong class="compare-balance">${money(sum.balance)}</strong><small class="muted">Net bakiye</small><div class="compare-line"><span>Gelir</span><b class="income-text">${money(sum.income)}</b></div><div class="compare-line"><span>Gider</span><b class="expense-text">${money(sum.expense)}</b></div><div class="compare-line"><span>Ödenen</span><b>${money(sum.paid)}</b></div><div class="compare-line"><span>Bekleyen</span><b>${money(sum.unpaid)}</b></div></article>`;
}

function renderSettings() {
  const custom = state.customCategories;
  const reminderSettings = null;
  byId('page-content').innerHTML = `
    <section class="page-heading"><div><span class="eyebrow">KİŞİSELLEŞTİRME</span><h1>Ayarlar</h1><p class="muted">Profil, görünüm, hatırlatmalar ve yedekleme.</p></div></section>
    <section class="content-card"><div class="section-title"><div><h2>Profil</h2><p class="muted">Bu cihazdaki yerel kullanıcı hesabınız</p></div>${avatarMarkup(state.profile, 'large')}</div><form id="profile-form" class="form-grid"><label>Ad Soyad<input name="name" value="${escapeHTML(state.profile?.name || '')}" required></label><label>E-posta<input name="email" type="email" value="${escapeHTML(state.profile?.email || '')}"></label><label class="full-field">Profil fotoğrafını değiştir<input name="avatar" type="file" accept="image/*"></label><button class="btn btn-secondary full-field" type="submit">Profili kaydet</button></form></section>
    <section class="content-card"><div class="section-title"><div><h2>Görünüm ve tema</h2><p class="muted">Açık, koyu ve beş pastel tema</p></div></div><div class="theme-grid">${THEMES.map(theme => `<button class="theme-choice ${state.theme === theme.id ? 'selected' : ''}" data-theme-choice="${theme.id}"><i style="background:${theme.color}"></i><span>${theme.name}</span>${state.theme === theme.id ? '<b>✓</b>' : ''}</button>`).join('')}</div></section>
    <section class="content-card"><div class="section-title"><div><h2>Ödeme hatırlatmaları</h2><p class="muted">Uygulama kapalıyken Android bildirimi</p></div><span class="section-icon">♧</span></div>
      <div class="form-grid"><label>Kaç gün önce hatırlatılsın?<select id="reminder-days"><option value="0">Son ödeme günü</option><option value="1">1 gün önce</option><option value="2">2 gün önce</option><option value="3">3 gün önce</option><option value="5">5 gün önce</option><option value="7">7 gün önce</option></select></label><label>Hatırlatma saati<input id="reminder-time" type="time" value="09:00"></label></div>
      <div class="settings-actions"><button class="btn btn-primary" data-action="enable-notifications">Bildirim iznini etkinleştir</button><button class="btn btn-secondary" data-action="exact-alarm">Tam zamanlı alarm ayarları</button></div><p class="help-text">Android 13 ve üzeri bildirim izni ister. Android 12 ve üzeri sürümlerde dakikası dakikasına hatırlatma için ayrıca “Alarmlar ve hatırlatıcılar” izni gerekebilir. Pil tasarrufu bazı cihazlarda gecikmeye neden olabilir.</p>
    </section>
    <section class="content-card"><div class="section-title"><div><h2>Kategori yönetimi</h2><p class="muted">Rutin gelir ve gider türlerine yeni seçenek ekleyin.</p></div></div><div class="form-grid"><label>Kategori türü<select id="new-category-type"><option value="expense">Gider</option><option value="income">Gelir</option></select></label><label>Yeni kategori<input id="new-category-name" placeholder="Örn. Kırtasiye"></label><button class="btn btn-secondary full-field" data-action="add-category">＋ Kategori ekle</button></div><div class="category-summary"><div><b>Gelir kategorileri</b><small>${categoriesFor('income', custom).map(escapeHTML).join(' · ')}</small></div><div><b>Gider kategorileri</b><small>${categoriesFor('expense', custom).map(escapeHTML).join(' · ')}</small></div></div></section>
    <section class="content-card"><div class="section-title"><div><h2>Yedekleme ve raporlar</h2><p class="muted">Verilerinizi dışarı aktarın veya geri yükleyin.</p></div></div><div class="backup-grid"><button class="backup-button" data-action="backup-export"><span>⇩</span><b>Yedek al</b><small>JSON dosyası</small></button><label class="backup-button upload-backup"><span>⇧</span><b>Yedeği yükle</b><small>JSON dosyasından geri yükle</small><input id="backup-import" type="file" accept="application/json,.json"></label><button class="backup-button" data-action="export-excel"><span>▦</span><b>Excel raporu</b><small>${escapeHTML(periodLabel(state.period))}</small></button><button class="backup-button" data-action="export-pdf"><span>▤</span><b>PDF raporu</b><small>${escapeHTML(periodLabel(state.period))}</small></button></div><p class="help-text">Yedek dosyası işlem kayıtlarınızı ve profil ayarlarınızı içerir; dosyayı güvenli bir yerde saklayın. Yedek geri yüklemek mevcut cihaz verilerinin üzerine yazar.</p></section>
    <section class="content-card danger-zone"><div><h2>Oturum</h2><p class="muted">Uygulamadan çıkış yapıldığında yeniden parola istenir.</p></div><button class="btn btn-secondary" data-action="logout">Oturumu kapat</button></section>`;
  loadReminderSettings();
}

async function loadReminderSettings() {
  const settings = await DB.getSetting('reminders', { reminderDays: 1, reminderTime: '09:00' });
  const days = byId('reminder-days'); const time = byId('reminder-time');
  if (days) days.value = String(settings.reminderDays ?? 1);
  if (time) time.value = settings.reminderTime || '09:00';
}

function renderPage() {
  if (!byId('page-content')) return;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.page === state.page));
  if (state.page === 'home') renderHome();
  if (state.page === 'transactions') renderTransactions();
  if (state.page === 'compare') renderCompare();
  if (state.page === 'settings') renderSettings();
}

function openEntryDialog(existing = null) {
  const item = existing || { type: 'expense', category: '', amount: '', period: state.period, dueDate: '', status: 'unpaid', note: '', repeatMonthly: false };
  const choices = categoriesFor(item.type, state.customCategories);
  byId('dialog-host').innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop"><section class="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title">
      <div class="modal-head"><div><span class="eyebrow">${existing ? 'KAYDI GÜNCELLE' : 'YENİ HAREKET'}</span><h2 id="entry-title">${existing ? 'Kaydı düzenle' : 'Gelir / gider ekle'}</h2></div><button class="icon-button" data-action="close-modal" aria-label="Kapat">×</button></div>
      <form id="entry-form" class="form-stack">
        <div class="type-toggle"><label><input type="radio" name="type" value="expense" ${item.type === 'expense' ? 'checked' : ''}><span>Gider</span></label><label><input type="radio" name="type" value="income" ${item.type === 'income' ? 'checked' : ''}><span>Gelir</span></label></div>
        <label>Gelir / gider türü<select name="category" required><option value="">Kategori seçin…</option>${choices.map(category => `<option value="${escapeHTML(category)}" ${item.category === category ? 'selected' : ''}>${escapeHTML(category)}</option>`).join('')}</select></label>
        <label>Miktar (TL)<input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" value="${item.amount === '' ? '' : Number(item.amount)}" required placeholder="0,00"></label>
        <div class="form-grid"><label>Harcama dönemi<input name="period" type="month" value="${item.period}" required></label><label>Son ödeme / tahsilat tarihi<input name="dueDate" type="date" value="${item.dueDate || ''}"></label></div>
        <label>Durum<select name="status"><option value="unpaid" ${item.status !== 'paid' ? 'selected' : ''}>${item.type === 'income' ? 'Bekleniyor' : 'Ödenmedi'}</option><option value="paid" ${item.status === 'paid' ? 'selected' : ''}>${item.type === 'income' ? 'Alındı' : 'Ödendi'}</option></select></label>
        <label>Not <span class="optional">(isteğe bağlı)</span><textarea name="note" rows="2" placeholder="Açıklama veya hatırlatma…">${escapeHTML(item.note || '')}</textarea></label>
        ${item.type === 'expense' && !existing ? '<label class="check-row"><input name="repeatMonthly" type="checkbox"><span>Her ay tekrarlansın (önümüzdeki 12 ay için otomatik kayıt oluştur)</span></label>' : ''}
        <div class="modal-actions"><button type="button" class="btn btn-secondary" data-action="close-modal">Vazgeç</button><button type="submit" class="btn btn-primary">${existing ? 'Değişiklikleri kaydet' : 'Kaydı oluştur'}</button></div>
      </form>
    </section></div>`;
  const typeRadios = [...byId('entry-form').elements.type];
  typeRadios.forEach(radio => radio.addEventListener('change', () => {
    const select = byId('entry-form').elements.category;
    const oldValue = select.value;
    select.innerHTML = `<option value="">Kategori seçin…</option>${categoriesFor(radio.value, state.customCategories).map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('')}`;
    if (categoriesFor(radio.value, state.customCategories).includes(oldValue)) select.value = oldValue;
    const status = byId('entry-form').elements.status;
    status.options[0].textContent = radio.value === 'income' ? 'Bekleniyor' : 'Ödenmedi';
    status.options[1].textContent = radio.value === 'income' ? 'Alındı' : 'Ödendi';
  }));
  byId('entry-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get('type'));
    const category = String(form.get('category') || '').trim();
    const amount = Number(form.get('amount'));
    const period = String(form.get('period'));
    const dueDate = String(form.get('dueDate') || '');
    if (!category || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}$/.test(period)) {
      notify('Kategori, geçerli miktar ve dönem girilmelidir.'); return;
    }
    const duplicate = state.items.find(row => row.id !== existing?.id && row.type === type && row.category.toLocaleLowerCase('tr-TR') === category.toLocaleLowerCase('tr-TR') && Number(row.amount) === amount && row.period === period && (row.dueDate || '') === dueDate);
    if (duplicate && !window.confirm('Bu dönemde aynı kategori, miktar ve tarih için benzer bir kayıt var. Yine de eklensin mi?')) return;
    const now = new Date().toISOString();
    const transaction = {
      ...(existing || {}), id: existing?.id || id(), type, category, amount, period, dueDate,
      status: String(form.get('status') || 'unpaid'), note: String(form.get('note') || '').trim(),
      repeatMonthly: Boolean(form.get('repeatMonthly')) || Boolean(existing?.repeatMonthly),
      updatedAt: now, createdAt: existing?.createdAt || now
    };
    if (transaction.repeatMonthly && !transaction.dueDate) {
      if (!window.confirm('Aylık tekrar için son ödeme tarihi boş. Bu kayıt yalnızca bu ay kaydedilsin mi?')) return;
      transaction.repeatMonthly = false;
    }
    await DB.saveTransaction(transaction);
    if (transaction.repeatMonthly && !transaction.recurringMasterId) transaction.recurringMasterId = transaction.id;
    await DB.saveTransaction(transaction);
    if (transaction.status === 'paid') await cancelReminder(transaction.id); else await scheduleReminder(transaction);
    state.items = await DB.allTransactions();
    if (transaction.repeatMonthly) await ensureRecurringOccurrences();
    state.period = period;
    byId('dialog-host').innerHTML = '';
    renderPage();
    notify(existing ? 'Kayıt güncellendi.' : 'Kayıt eklendi.');
  });
}

function addMonthsToDate(dateString, monthDelta) {
  const [year, month, day] = dateString.split('-').map(Number);
  const firstOfTarget = new Date(year, month - 1 + monthDelta, 1);
  const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return `${firstOfTarget.getFullYear()}-${String(firstOfTarget.getMonth() + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
}

async function ensureRecurringOccurrences() {
  const all = await DB.allTransactions();
  const masters = all.filter(item => item.repeatMonthly && item.recurringMasterId === item.id && item.type === 'expense' && item.dueDate);
  const todayPeriod = currentPeriod();
  const todayMonthIndex = Number(todayPeriod.slice(0, 4)) * 12 + Number(todayPeriod.slice(5, 7));
  for (const master of masters) {
    const masterMonthIndex = Number(master.period.slice(0, 4)) * 12 + Number(master.period.slice(5, 7));
    const firstOffset = Math.max(1, todayMonthIndex - masterMonthIndex);
    for (let offset = firstOffset; offset <= firstOffset + 11; offset++) {
      const dueDate = addMonthsToDate(master.dueDate, offset);
      const period = dueDate.slice(0, 7);
      const exists = all.some(item => item.recurringMasterId === master.id && item.period === period);
      if (exists) continue;
      const now = new Date().toISOString();
      const copy = { ...master, id: id(), recurringMasterId: master.id, repeatMonthly: false, dueDate, period, status: 'unpaid', createdAt: now, updatedAt: now, note: master.note ? `${master.note} (otomatik tekrar)` : 'Otomatik aylık tekrar' };
      await DB.saveTransaction(copy);
      all.push(copy);
    }
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const next = { ...state.profile, name: String(form.get('name') || '').trim(), email: String(form.get('email') || '').trim() };
  const file = form.get('avatar');
  if (file instanceof File && file.size) {
    if (file.size > 2 * 1024 * 1024) { notify('Fotoğraf en fazla 2 MB olabilir.'); return; }
    next.avatar = await readFileAsDataURL(file);
  }
  await DB.setSetting('profile', next);
  state.profile = next;
  renderShell();
  notify('Profil güncellendi.');
}

async function exportBackup() {
  const data = await DB.exportAll();
  await exportFile(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }), `butce-takip-yedek-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  notify('Yedek dosyası hazırlandı.');
}

async function importBackup(file) {
  if (!file) return;
  if (!window.confirm('Yedek geri yüklendiğinde bu cihazdaki mevcut kayıtlar silinip yedekteki verilerle değiştirilecek. Devam edilsin mi?')) return;
  try {
    const data = JSON.parse(await file.text());
    await DB.importAll(data);
    state.profile = await DB.getSetting('profile');
    state.customCategories = await DB.getSetting('customCategories', { income: [], expense: [] });
    state.items = await DB.allTransactions();
    setTheme(await DB.getSetting('theme', 'light'));
    renderShell();
    await syncAllReminders();
    notify('Yedek başarıyla geri yüklendi.');
  } catch (error) { notify(error.message || 'Yedek dosyası okunamadı.'); }
}

async function addCategory() {
  const type = byId('new-category-type').value;
  const input = byId('new-category-name');
  const name = input.value.trim();
  if (!name) { notify('Kategori adını yazın.'); return; }
  const custom = await DB.getSetting('customCategories', { income: [], expense: [] });
  if (!categoriesFor(type, custom).some(value => value.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'))) {
    custom[type] = [...(custom[type] || []), name];
    await DB.setSetting('customCategories', custom);
    state.customCategories = custom;
  }
  renderSettings();
  notify('Kategori eklendi.');
}

async function handleClick(event) {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) {
    state.page = pageButton.dataset.page;
    renderPage();
    return;
  }
  const themeButton = event.target.closest('[data-theme-choice]');
  if (themeButton) { setTheme(themeButton.dataset.themeChoice); renderSettings(); return; }
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) { state.listFilter = filterButton.dataset.filter; renderTransactionsListSafe(); return; }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'period-prev' || action === 'period-next') {
    state.period = movePeriod(state.period, action === 'period-prev' ? -1 : 1);
    renderPage();
  }
  if (action === 'add-entry') openEntryDialog();
  if (action === 'close-modal') byId('dialog-host').innerHTML = '';
  if (action === 'edit-entry') {
    const item = state.items.find(row => row.id === button.dataset.id);
    if (item) openEntryDialog(item);
  }
  if (action === 'delete-entry') {
    const item = state.items.find(row => row.id === button.dataset.id);
    if (item && window.confirm(`“${item.category}” kaydı silinsin mi?`)) {
      await DB.deleteTransaction(item.id); await cancelReminder(item.id);
      state.items = await DB.allTransactions(); renderPage(); notify('Kayıt silindi.');
    }
  }
  if (action === 'toggle-status') {
    const item = state.items.find(row => row.id === button.dataset.id);
    if (item) {
      item.status = item.status === 'paid' ? 'unpaid' : 'paid';
      item.updatedAt = new Date().toISOString();
      await DB.saveTransaction(item);
      if (item.status === 'paid') await cancelReminder(item.id); else await scheduleReminder(item);
      state.items = await DB.allTransactions(); renderPage(); notify(item.status === 'paid' ? 'Ödendi olarak işaretlendi.' : 'Bekleyen olarak güncellendi.');
    }
  }
  if (action === 'enable-notifications') {
    const result = await requestNotificationPermission();
    if (!result.supported) notify(result.message);
    else if (result.permission === 'granted') { await syncAllReminders(); notify(result.exact === 'granted' ? 'Bildirimler ve tam zamanlı alarmlar etkin.' : 'Bildirim izni etkin. Dakikası dakikasına alarm için Android ayarını da açın.'); }
    else notify('Bildirim izni verilmedi. Android uygulama ayarlarından açabilirsiniz.');
  }
  if (action === 'exact-alarm') { await openExactAlarmSettings(); notify('Android alarm izni ayarları açıldıysa izni etkinleştirin.'); }
  if (action === 'add-category') await addCategory();
  if (action === 'backup-export') await exportBackup();
  if (action === 'export-excel') { await exportExcel(state.period, state.items, await DB.getPeriodNote(state.period)); notify('Excel raporu oluşturuldu.'); }
  if (action === 'export-pdf') { await exportPDF(state.period, state.items, await DB.getPeriodNote(state.period)); notify('PDF raporu oluşturuldu.'); }
  if (action === 'logout') { state.profile = null; renderAuth('login'); }
}

function renderTransactionsListSafe() {
  document.querySelectorAll('[data-filter]').forEach(button => button.classList.toggle('active', button.dataset.filter === state.listFilter));
  renderTransactionList();
}

async function handleInput(event) {
  if (event.target.id === 'transaction-search') {
    state.search = event.target.value;
    renderTransactionList();
  }
  if (event.target.id === 'period-note') {
    const period = state.period;
    const status = byId('note-save-status');
    if (status) status.textContent = 'Kaydediliyor…';
    clearTimeout(handleInput.noteTimer);
    const note = event.target.value;
    handleInput.noteTimer = setTimeout(async () => {
      await DB.setPeriodNote(period, note);
      const current = byId('note-save-status'); if (current) current.textContent = 'Kaydedildi';
    }, 350);
  }
}

async function handleChange(event) {
  if (event.target.id === 'compare-from') { state.compareFrom = event.target.value; renderCompare(); }
  if (event.target.id === 'compare-to') { state.compareTo = event.target.value; renderCompare(); }
  if (event.target.id === 'backup-import') await importBackup(event.target.files?.[0]);
  if (event.target.id === 'reminder-days' || event.target.id === 'reminder-time') {
    const current = await DB.getSetting('reminders', { reminderDays: 1, reminderTime: '09:00' });
    if (event.target.id === 'reminder-days') current.reminderDays = Number(event.target.value);
    if (event.target.id === 'reminder-time') current.reminderTime = event.target.value;
    await DB.setSetting('reminders', current);
    await syncAllReminders();
    notify('Hatırlatma ayarları kaydedildi.');
  }
}

async function boot() {
  try {
    await DB.init();
    await setupNotificationActions(item => {
      state.items = state.items.map(row => row.id === item.id ? item : row);
      if (byId('main-shell')) renderPage();
      notify(`${item.category}: ödendi olarak işaretlendi.`);
    });
    const profile = await DB.getSetting('profile');
    if (!profile) renderAuth('register');
    else renderAuth('login');
  } catch (error) {
    app.innerHTML = `<div class="fatal-error"><h2>Uygulama başlatılamadı</h2><p>${escapeHTML(error.message || 'Bilinmeyen hata')}</p></div>`;
  }
}

document.addEventListener('click', handleClick);
document.addEventListener('input', handleInput);
document.addEventListener('change', handleChange);
document.addEventListener('submit', event => {
  if (event.target.id === 'profile-form') saveProfile(event);
});

boot();
