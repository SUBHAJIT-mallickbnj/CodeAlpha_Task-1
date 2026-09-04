const form = document.querySelector('#shorten-form');
const input = document.querySelector('#url-input');
const result = document.querySelector('#result');
const linksList = document.querySelector('#links-list');
const linkCount = document.querySelector('#link-count');
const databaseButton = document.querySelector('#database-button');
const viewDatabaseButton = document.querySelector('#view-database');
const authModal = document.querySelector('#auth-modal');
const databaseModal = document.querySelector('#database-modal');
const authForm = document.querySelector('#auth-form');
const authError = document.querySelector('#auth-error');
const databaseList = document.querySelector('#database-list');
const databaseCount = document.querySelector('#database-count');
const themeToggle = document.querySelector('#theme-toggle');

let allLinks = [];

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[character]));
}

function renderLinks(links) {
  linkCount.textContent = `${links.length} link${links.length === 1 ? '' : 's'}`;
  linksList.innerHTML = links.length ? links.map((link) => `
    <article class="link-item">
      <div class="link-icon">↗</div><div class="link-details"><a href="/${link.code}">${location.host}/${link.code}</a><p title="${escapeHtml(link.originalUrl)}">${escapeHtml(link.originalUrl)}</p></div>
      <div class="link-meta"><span>${link.clicks} click${link.clicks === 1 ? '' : 's'}</span><time>${new Date(link.createdAt + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
      <button class="copy-small" data-copy="${escapeHtml(link.shortUrl)}" aria-label="Copy short link">Copy</button>
    </article>`).join('') : '<div class="empty-state">Your latest links will land here.</div>';
}

function renderDatabase(links) {
  databaseCount.textContent = `${links.length} saved link${links.length === 1 ? '' : 's'}`;
  databaseList.innerHTML = links.length ? links.map((link) => `
    <article class="database-row">
      <div><a href="/${link.code}" target="_blank">${location.host}/${link.code}</a><p title="${escapeHtml(link.originalUrl)}">${escapeHtml(link.originalUrl)}</p></div>
      <span class="row-stat">${link.clicks} click${link.clicks === 1 ? '' : 's'}<br>${new Date(link.createdAt + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      <button class="copy-small" data-copy="${escapeHtml(link.shortUrl)}">Copy</button>
    </article>`).join('') : '<div class="empty-state">No links saved yet. Your archive will appear here.</div>';
}

function openModal(modal) {
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.hidden = true;
  document.body.style.overflow = '';
}

async function openDatabase() {
  authError.textContent = '';
  authForm.reset();
  openModal(authModal);
}

async function unlockDatabase() {
  const username = document.querySelector('#username').value.trim();
  const password = document.querySelector('#password').value;
  if (username !== 'linkroom' || password !== 'linkroom@123') {
    authError.textContent = 'That workspace login does not match.';
    return;
  }
  closeModal(authModal);
  renderDatabase(allLinks);
  openModal(databaseModal);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === 'dark' ? '☀' : '☾';
  themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  localStorage.setItem('linkloom-theme', theme);
}

async function loadLinks() {
  const response = await fetch('/api/links');
  allLinks = await response.json();
  renderLinks(allLinks.slice(0, 8));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'Making it shorter...';
  result.className = 'result';
  try {
    const response = await fetch('/api/shorten', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: input.value }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    result.className = 'result visible success';
    result.innerHTML = `<span class="result-label">Your short link</span><a href="/${data.code}" target="_blank">${data.shortUrl}</a><button class="copy-result" data-copy="${escapeHtml(data.shortUrl)}">Copy link</button>`;
    input.value = '';
    await loadLinks();
  } catch (error) {
    result.className = 'result visible error';
    result.textContent = error.message || 'Something went wrong. Try again.';
  } finally {
    button.disabled = false;
    button.querySelector('span:first-child').textContent = 'Shorten link';
  }
});

document.addEventListener('click', async (event) => {
  const copyButton = event.target.closest('[data-copy]');
  if (!copyButton) return;
  await navigator.clipboard.writeText(copyButton.dataset.copy);
  const originalText = copyButton.textContent;
  copyButton.textContent = 'Copied';
  setTimeout(() => { copyButton.textContent = originalText; }, 1400);
});

databaseButton.addEventListener('click', openDatabase);
viewDatabaseButton.addEventListener('click', openDatabase);
authForm.addEventListener('submit', (event) => { event.preventDefault(); unlockDatabase(); });
themeToggle.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.closest('.modal-backdrop'))));
document.querySelectorAll('.modal-backdrop').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); }));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop:not([hidden])').forEach(closeModal); });

applyTheme(localStorage.getItem('linkloom-theme') || 'light');

loadLinks().catch(() => { linksList.innerHTML = '<div class="empty-state">Could not load your link shelf.</div>'; });