import {MAX_BYTES, normalizeSite, parseInput, buildPreview, importOrigins, exportOrigins, makeJSON, makeNetscape} from './core.mjs';
import {importCookies, readForExport} from './cookie-api.mjs';
import {CookieContextError, resolveCookieContext, revalidateCookieContext} from './browser-context.mjs';

const $ = id => document.getElementById(id);
const api = globalThis.chrome;
let rows = [];
let busy = false;
let fileRead = 0;
let previewSite = '';
let cookieContext = null;

function contextLabel(context = cookieContext) {
  return context?.incognito ? '無痕視窗' : '一般視窗';
}

function displayContext(context) {
  $('context-banner').classList.toggle('incognito', Boolean(context?.incognito));
  $('context-label').textContent = context ? contextLabel(context) : '無法確認視窗';
  $('context-note').textContent = !context ? '已停用讀寫。請從目標視窗重新開啟工具。' : context.incognito ?
    '目前只讀寫無痕 Cookie。關閉所有無痕視窗（包含此分頁）後，無痕 Cookie 會清除；已下載的備份檔仍會保留。' :
    '目前只讀寫一般視窗的 Cookie。要操作無痕 Cookie，請在無痕視窗點選擴充功能圖示。';
}

async function confirmContext() {
  try { return await revalidateCookieContext(api, cookieContext); }
  catch (error) {
    cookieContext = null;
    displayContext(null);
    throw error;
  }
}

function status(message, error = false) {
  $('status').textContent = message;
  $('status').hidden = !message;
  $('status').classList.toggle('error', error);
}

function refreshSelection() {
  const boxes = [...document.querySelectorAll('.row-select')];
  const count = boxes.filter(box => box.checked).length;
  $('import').disabled = busy || !cookieContext || count === 0;
  $('import').textContent = `匯入 ${count} 筆已選 Cookie`;
  $('select-all').checked = boxes.length > 0 && count === boxes.length;
  $('select-all').indeterminate = count > 0 && count < boxes.length;
  $('select-all').disabled = busy || !cookieContext || !boxes.length;
}

function setBusy(value) {
  busy = value;
  document.body.classList.toggle('busy', value || !cookieContext);
  for (const el of document.querySelectorAll('button,input,textarea,select')) el.disabled = value || !cookieContext;
  refreshSelection();
}

function invalidate() {
  rows = [];
  previewSite = '';
  $('preview-section').hidden = true;
  $('preview-body').replaceChildren();
  refreshSelection();
}

function clearData() {
  fileRead++;
  $('source').value = '';
  $('file').value = '';
  $('filename').textContent = '尚未選擇檔案';
  $('show-source').checked = false;
  $('source').classList.remove('revealed');
  $('paste-details').open = false;
  invalidate();
}

function cell(tr, text = '', className = '') {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  tr.append(td);
  return td;
}

function sub(parent, text) {
  const el = document.createElement('small');
  el.textContent = text;
  parent.append(el);
}

function tag(parent, text, className = '') {
  const el = document.createElement('span');
  el.textContent = text;
  el.className = `tag ${className}`;
  parent.append(el);
}

function displayPreview(parsed) {
  const ready = rows.filter(row => row.status === 'ready').length;
  $('format').textContent = parsed.format;
  $('total-count').textContent = rows.length;
  $('ready-count').textContent = ready;
  $('skip-count').textContent = rows.length - ready;
  const warnings = [...parsed.warnings];
  if (rows.some(r => r.cookie?.partitionKey)) warnings.push('含分割 Cookie：將保留來源 partitionKey，不改成未分割 Cookie。');
  if (rows.some(r => r.status === 'ready' && r.cookie.name.startsWith('__Secure-next-auth.session-token.'))) warnings.push('含分段登入 Cookie；請一併選取所有分段。本站若有舊的額外分段，本工具不會自動刪除。');
  $('warnings').replaceChildren();
  for (const warning of warnings) {
    const p = document.createElement('p'); p.textContent = warning; $('warnings').append(p);
  }
  $('warnings').hidden = !warnings.length;
  const fragment = document.createDocumentFragment();
  rows.forEach((row, index) => {
    const tr = document.createElement('tr');
    const selection = cell(tr);
    if (row.status === 'ready') {
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = true;
      checkbox.className = 'row-select'; checkbox.dataset.index = String(index);
      checkbox.setAttribute('aria-label', `選取 ${row.cookie.name || '無名稱 Cookie'}，來源 ${row.source}`);
      checkbox.addEventListener('change', refreshSelection); selection.append(checkbox);
    }
    const name = cell(tr, row.cookie?.name || (row.cookie ? '（無名稱）' : '無法解析'), 'code');
    sub(name, `來源第 ${row.source} 筆 / 行`);
    const domain = cell(tr, row.cookie?.domain || '—', 'code');
    if (row.cookie) sub(domain, row.cookie.path);
    const attrs = cell(tr);
    if (row.cookie) {
      const c = row.cookie;
      if (c.secure) tag(attrs, 'Secure');
      if (c.httpOnly) tag(attrs, 'HttpOnly');
      tag(attrs, c.hostOnly ? '僅此主機' : '含子網域', 'dim');
      tag(attrs, `SameSite: ${{no_restriction:'None',lax:'Lax',strict:'Strict',unspecified:'未指定'}[c.sameSite]}`, 'dim');
      if (c.partitionKey) { tag(attrs, 'Partitioned'); sub(attrs, c.partitionKey.topLevelSite); }
    }
    cell(tr, row.cookie ? (row.cookie.session ? '工作階段' : new Date(row.cookie.expirationDate * 1000).toLocaleString('zh-TW')) : '—');
    const outcome = cell(tr);
    tag(outcome, {ready:'可匯入',outside:'其他主機',expired:'已過期',duplicate:'重複',invalid:'格式有誤'}[row.status], row.status === 'invalid' ? 'bad' : (row.status === 'ready' ? '' : 'dim'));
    sub(outcome, row.reason);
    fragment.append(tr);
  });
  $('preview-body').replaceChildren(fragment);
  $('preview-section').hidden = false;
  refreshSelection();
}

async function loadFile(file) {
  if (!file || busy || !cookieContext) return;
  const token = ++fileRead;
  invalidate();
  $('source').value = '';
  if (file.size > MAX_BYTES) { $('filename').textContent = '檔案超過 5 MiB'; status('檔案上限為 5 MiB。', true); return; }
  try {
    const text = await file.text();
    if (token !== fileRead || busy) return;
    $('source').value = text;
    $('filename').textContent = `${file.name} · ${Math.max(1, Math.ceil(file.size / 1024))} KiB`;
    status('已載入檔案。按「解析並預覽」檢查內容。');
  } catch { if (token === fileRead) status('無法讀取檔案，請重新選擇。', true); }
}

function showResults(results) {
  const counts = {success:0,adjusted:0,skipped:0,failed:0};
  $('result-body').replaceChildren();
  for (const result of results) {
    counts[result.status]++;
    const tr = document.createElement('tr');
    cell(tr, result.name || '（無名稱）', 'code');
    sub(cell(tr, result.domain, 'code'), result.path);
    const out = cell(tr);
    tag(out, {success:'成功',adjusted:'成功 / 有調整',skipped:'略過',failed:'失敗'}[result.status], result.status === 'failed' ? 'bad' : '');
    sub(out, result.message); $('result-body').append(tr);
  }
  $('result-summary').textContent = `成功 ${counts.success} 筆、瀏覽器調整 ${counts.adjusted} 筆、略過 ${counts.skipped} 筆、失敗 ${counts.failed} 筆。`;
  $('result-section').hidden = false;
}

function download(text, filename, mime) {
  const url = URL.createObjectURL(new Blob([text], {type:mime}));
  const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function switchMode(mode) {
  if (busy) return;
  for (const item of ['import','export']) {
    $(item + '-panel').hidden = item !== mode;
    $(item + '-tab').setAttribute('aria-selected', String(item === mode));
    $(item + '-tab').tabIndex = item === mode ? 0 : -1;
  }
  status('');
}

$('site').addEventListener('input', () => { invalidate(); status(''); });
$('source').addEventListener('input', () => {
  fileRead++; $('file').value = ''; $('filename').textContent = '使用貼上的資料'; invalidate(); status('');
});
$('show-source').addEventListener('change', () => $('source').classList.toggle('revealed', $('show-source').checked));
$('clear').addEventListener('click', () => {
  clearData(); $('result-section').hidden = true; $('result-body').replaceChildren();
  status('已清除畫面中的來源資料。已匯入的 Cookie 與下載檔不受影響。');
});
$('file').addEventListener('change', event => loadFile(event.target.files[0]));
$('file-zone').addEventListener('dragover', event => { event.preventDefault(); if (!busy) $('file-zone').classList.add('dragover'); });
$('file-zone').addEventListener('dragleave', () => $('file-zone').classList.remove('dragover'));
$('file-zone').addEventListener('drop', event => {
  event.preventDefault(); $('file-zone').classList.remove('dragover');
  if (event.dataTransfer.files.length !== 1) { status('一次請選擇一個 Cookie 檔案。', true); return; }
  loadFile(event.dataTransfer.files[0]);
});
$('preview').addEventListener('click', () => {
  invalidate(); $('result-section').hidden = true;
  try {
    const site = normalizeSite($('site').value);
    const parsed = parseInput($('source').value);
    previewSite = site.origin;
    rows = buildPreview(parsed, previewSite);
    displayPreview(parsed);
    $('paste-details').open = false;
    status('預覽完成，尚未寫入。Cookie 值不會顯示在下方表格。');
  } catch (error) { status(error.message, true); }
});
$('select-all').addEventListener('change', () => {
  for (const box of document.querySelectorAll('.row-select')) box.checked = $('select-all').checked;
  refreshSelection();
});

$('import').addEventListener('click', async () => {
  if (busy || !cookieContext) return;
  const cookies = [...document.querySelectorAll('.row-select:checked')].map(box => rows[Number(box.dataset.index)].cookie);
  if (!cookies.length) return;
  let importing = false;
  try {
    const site = previewSite;
    if (!site || normalizeSite($('site').value).origin !== site) throw new Error('目標網站已變更，請重新預覽。');
    const origins = importOrigins(cookies, site);
    const overwrite = $('conflict').value === 'replace';
    // Must be called synchronously from the user's click, before any awaited work.
    const permission = api.permissions.request({origins});
    setBusy(true);
    if (!await permission) { status('網站授權未取得，沒有寫入任何 Cookie。', true); return; }
    const context = await confirmContext();
    importing = true;
    const results = await importCookies(api, cookies, site, {storeId:context.storeId, overwrite,
      onProgress:(_row, done, total) => status(`正在匯入${contextLabel(context)}：${done} / ${total}。請保持此分頁開啟。`)});
    showResults(results);
    clearData();
    status(`${contextLabel(context)}的匯入作業完成，請查看逐筆結果。來源值已從畫面清除；可回到相同模式的網站分頁手動重新整理。`);
  } catch (error) {
    status(error instanceof CookieContextError ? error.message : importing ? '匯入作業中斷，可能已有部分 Cookie 寫入。請重新預覽後檢查。' : '無法開始匯入。請確認來源未過期、已預覽，且擴充功能有權限。', true);
  } finally { cookies.length = 0; setBusy(false); }
});

$('export').addEventListener('click', async () => {
  if (busy || !cookieContext) return;
  let stage = 'validate';
  try {
    const site = normalizeSite($('site').value);
    const partitionSite = $('partition-site').value.trim() ? normalizeSite($('partition-site').value).origin : '';
    const format = $('export-format').value;
    if (partitionSite && format !== 'json') throw new Error('分割 Cookie 請使用 JSON 匯出。');
    const permission = api.permissions.request({origins:exportOrigins(site.origin)});
    stage = 'read'; setBusy(true);
    if (!await permission) { status('網站授權未取得，沒有匯出 Cookie。', true); return; }
    const context = await confirmContext();
    const cookies = await readForExport(api, site.origin, partitionSite, {storeId:context.storeId});
    if (!cookies.length) { status(`${contextLabel(context)}的目標主機沒有可匯出的 Cookie。請確認網址；父網域需另外匯出。`); return; }
    stage = 'serialize';
    const scope = `${contextLabel(context)} / ${partitionSite ? `未分割 Cookie + 分割網站 ${partitionSite}` : '未分割 Cookie'}`;
    const contents = format === 'json' ? makeJSON(cookies, site.origin, scope) : makeNetscape(cookies);
    const host = site.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    download(contents, `cookies-${host}-${context.incognito ? 'incognito' : 'regular'}-${new Date().toISOString().slice(0,10)}.${format}`, format === 'json' ? 'application/json' : 'text/plain;charset=utf-8');
    status(`已送出${contextLabel(context)} ${cookies.length} 筆 Cookie 的下載，請到瀏覽器下載項目確認。${format === 'txt' ? ' cookies.txt 不含 SameSite 與分割資訊。' : ''}`);
    cookies.length = 0;
  } catch (error) {
    status(error instanceof CookieContextError ? error.message : stage === 'read' ? '讀取失敗。請確認網站授權、頂層網站格式及瀏覽器版本。' : error.message, true);
  } finally { setBusy(false); }
});

for (const mode of ['import','export']) {
  $(mode + '-tab').addEventListener('click', () => switchMode(mode));
  $(mode + '-tab').addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault(); const next = event.key === 'Home' ? 'import' : event.key === 'End' ? 'export' : mode === 'import' ? 'export' : 'import';
      switchMode(next); $(next + '-tab').focus();
    }
  });
}
$('revoke').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true);
  try {
    const {origins = []} = await api.permissions.getAll();
    if (!origins.length) { status('目前沒有已授權的網站。'); return; }
    const removed = await api.permissions.remove({origins});
    status(removed ? '已撤銷網站權限；已匯入的 Cookie 不受影響。' : '部分權限未能撤銷，請到擴充功能管理頁檢查。', !removed);
  } catch { status('無法撤銷權限，請到擴充功能管理頁檢查。', true); }
  finally { setBusy(false); }
});

try {
  const site = new URL(location.href).searchParams.get('site');
  if (site) $('site').value = normalizeSite(site).origin;
} catch { /* Ignore malformed URL parameters; no cookie data is accepted here. */ }
setBusy(true);
if (!api?.cookies || !api?.permissions || !api?.tabs || !api?.extension) {
  displayContext(null);
  status('請先在 Chrome / Edge 載入此擴充功能，再從工具列圖示開啟。直接開啟 HTML 無法讀寫 Cookie。', true);
} else {
  try {
    cookieContext = await resolveCookieContext(api);
    displayContext(cookieContext);
  } catch (error) {
    displayContext(null);
    status(error.message, true);
  } finally { setBusy(false); }
}
