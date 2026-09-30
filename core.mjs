export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_COOKIES = 5000;
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const plain = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = (message) => { throw new Error(message); };

export function normalizeHost(value) {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail('Domain 必須是有效的主機名稱。');
  const raw = value.startsWith('.') ? value.slice(1) : value;
  if (!raw || /[\s/@?#\\%*]/u.test(raw) || raw.endsWith('.')) fail('Domain 格式不正確。');
  let url;
  try { url = new URL(`https://${raw}/`); } catch { fail('Domain 格式不正確。'); }
  if (url.port || (raw.includes(':') && !raw.startsWith('['))) fail('Domain 不可包含連接埠。');
  const host = url.hostname;
  if (!host.startsWith('[') && (!/^[a-z0-9.-]+$/i.test(host) || host.split('.').some(p => !p || p.startsWith('-') || p.endsWith('-')))) {
    fail('Domain 格式不正確。');
  }
  return host;
}

export function normalizeSite(value) {
  if (typeof value !== 'string' || !value.trim()) fail('請先輸入目標網站，例如 https://chatgpt.com。');
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`); }
  catch { fail('目標網站網址不正確。'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail('請使用不含帳號密碼的 HTTP 或 HTTPS 網址。');
  normalizeHost(url.hostname);
  return url;
}

function bool(obj, key, fallback, notes) {
  if (!own(obj, key)) {
    if (notes) notes.push(`缺少 ${key}，使用 ${String(fallback)}。`);
    return fallback;
  }
  if (typeof obj[key] !== 'boolean') fail(`${key} 必須是 true 或 false。`);
  return obj[key];
}

function sameSite(value, notes) {
  if (value === undefined || value === null || value === '') {
    notes.push('未提供 SameSite，匯入時不指定。');
    return 'unspecified';
  }
  if (typeof value !== 'string') fail('SameSite 格式不正確。');
  const allowed = new Map([['none','no_restriction'],['no_restriction','no_restriction'],['lax','lax'],['strict','strict'],['unspecified','unspecified']]);
  const mapped = allowed.get(value.toLowerCase());
  if (!mapped) fail('SameSite 必須是 None、Lax、Strict 或 unspecified。');
  return mapped;
}

function partition(value) {
  if (value === undefined || value === null) return undefined;
  if (!plain(value) || typeof value.topLevelSite !== 'string' || !value.topLevelSite) fail('partitionKey 必須包含 topLevelSite。');
  const site = normalizeSite(value.topLevelSite);
  if (site.pathname !== '/' || site.search || site.hash || site.port || !/^https?:\/\//.test(value.topLevelSite)) {
    fail('partitionKey.topLevelSite 必須是含協定的網站來源，不可包含路徑、連接埠或查詢。');
  }
  const result = {topLevelSite: site.origin};
  // Older exports can omit this bit. Guessing it can overwrite a different
  // partition, particularly when the user explicitly selected "skip existing".
  if (!own(value, 'hasCrossSiteAncestor')) fail('partitionKey 缺少 hasCrossSiteAncestor；請使用新版 Chrome 重新匯出 JSON。');
  result.hasCrossSiteAncestor = bool(value, 'hasCrossSiteAncestor');
  for (const key of Object.keys(value)) {
    if (!['topLevelSite','hasCrossSiteAncestor'].includes(key)) fail('含有不支援的 partitionKey 屬性，請改用 Chrome Cookie JSON。');
  }
  return result;
}

export function normalizeCookie(raw) {
  if (!plain(raw)) fail('每一筆 Cookie 必須是 JSON 物件。');
  if (typeof raw.name !== 'string' || typeof raw.value !== 'string') fail('name 與 value 必須是字串。');
  // Reject delimiters/control bytes; never echo cookie values in errors.
  if (/[\x00-\x20\x7f()<>@,;:\\"/\[\]?={}]/.test(raw.name) || /[^\x00-\x7f]/.test(raw.name)) fail('Cookie 名稱含有不支援的字元。');
  if (/[\x00-\x1f\x7f;]/.test(raw.value) || raw.value !== raw.value.trim()) fail('Cookie 值含控制字元、分號或前後空白，無法原樣匯入。');
  if (!raw.name && (!raw.value || raw.value.includes('='))) fail('無名稱 Cookie 的值不可為空或包含等號。');
  if (new TextEncoder().encode(raw.name + raw.value).length > 4096) fail('name 與 value 合計超過 4096 bytes。');
  const host = normalizeHost(raw.domain);
  const notes = [];
  const hostOnly = bool(raw, 'hostOnly', !raw.domain.startsWith('.'));
  if (!own(raw, 'hostOnly')) notes.push('未提供 hostOnly，依 Domain 的開頭句點推定；請確認來源。');
  if (!hostOnly && (host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host))) fail('IP 位址 Cookie 必須是 hostOnly。');
  const path = own(raw, 'path') ? raw.path : '/';
  if (!own(raw, 'path')) notes.push('缺少 Path，使用 /。');
  if (typeof path !== 'string' || !path.startsWith('/') || /[\x00-\x1f\x7f;]/.test(path)) fail('Path 必須以 / 開頭且不可含控制字元或分號。');
  const secure = bool(raw, 'secure', false, notes);
  const httpOnly = bool(raw, 'httpOnly', false, notes);
  const ss = sameSite(raw.sameSite, notes);
  const key = partition(raw.partitionKey);
  if (raw.partitioned === true && !key) fail('分割 Cookie 缺少 partitionKey，無法匯入。');
  if (own(raw, 'firstPartyDomain') && raw.firstPartyDomain) fail('不支援 Firefox firstPartyDomain，請使用 Chrome JSON。');
  if (raw.name.startsWith('__Secure-') && !secure) fail('__Secure- Cookie 必須設為 Secure。');
  if (raw.name.startsWith('__Host-') && (!secure || !hostOnly || path !== '/')) fail('__Host- Cookie 必須 Secure、hostOnly=true、Path=/。');
  if ((raw.name.startsWith('__Http-') || raw.name.startsWith('__Host-Http-')) && (!secure || !httpOnly)) fail('__Http- / __Host-Http- Cookie 必須 Secure 與 HttpOnly。');
  if (ss === 'no_restriction' && !secure) fail('SameSite=None 必須搭配 Secure。');
  if (key && !secure) fail('分割 Cookie 必須搭配 Secure。');
  const hasSession = own(raw, 'session');
  const explicitSession = hasSession ? bool(raw, 'session') : undefined;
  const exp = own(raw, 'expirationDate') ? raw.expirationDate : raw.expires;
  let expiry;
  if (explicitSession !== true && exp !== undefined && exp !== null) {
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp < -1) fail('到期時間必須是 Unix 秒數。');
    if (exp > 100_000_000_000) fail('到期時間疑似毫秒，請改為 Unix 秒數。');
    if (exp > 0 || (hasSession && explicitSession === false)) expiry = exp;
  }
  if (explicitSession === false && expiry === undefined) fail('session=false 時必須提供到期時間。');
  if (!hasSession && (exp === 0 || exp === -1)) notes.push('到期時間為 0 / -1，視為工作階段 Cookie。');
  if (explicitSession === true && exp !== undefined && exp !== null) notes.push('session=true，忽略來源中的到期時間。');
  const cookie = {domain: hostOnly ? host : `.${host}`, hostOnly, path, secure, httpOnly, sameSite:ss, name:raw.name, value:raw.value, session:expiry === undefined};
  if (expiry !== undefined) cookie.expirationDate = expiry;
  if (key) cookie.partitionKey = key;
  // A store identifier belongs to its original profile, never copy it to another.
  if (raw.storeId !== undefined) notes.push('來源 storeId 不會沿用；將使用此管理分頁所在的一般或無痕儲存區。');
  return {cookie, notes};
}

export function cookieKey(cookie) {
  return JSON.stringify([normalizeHost(cookie.domain), cookie.hostOnly, cookie.path, cookie.name,
    cookie.partitionKey?.topLevelSite ?? null, cookie.partitionKey ? (cookie.partitionKey.hasCrossSiteAncestor ?? false) : null]);
}

export function matchesSite(cookie, host) {
  const domain = normalizeHost(cookie.domain);
  return host === domain || (!cookie.hostOnly && host.endsWith(`.${domain}`));
}

function netscapeLine(line) {
  const httpOnly = line.startsWith('#HttpOnly_');
  const fields = (httpOnly ? line.slice(10) : line).split('\t');
  if (fields.length !== 7) fail('cookies.txt 每筆必須有 7 欄，以 Tab 分隔；不支援 Cookie 請求標頭。');
  const [domain, includeSubdomains, path, secureFlag, expiry, name, value] = fields;
  if (!/^(TRUE|FALSE)$/i.test(includeSubdomains) || !/^(TRUE|FALSE)$/i.test(secureFlag)) fail('子網域與 Secure 欄位必須是 TRUE 或 FALSE。');
  if (!/^\d+$/.test(expiry) || !Number.isSafeInteger(Number(expiry))) fail('到期欄位必須是 Unix 秒數；工作階段 Cookie 請填 0。');
  return {domain, hostOnly:includeSubdomains.toUpperCase() === 'FALSE', path, secure:secureFlag.toUpperCase() === 'TRUE', expirationDate:Number(expiry), session:Number(expiry) === 0, name, value, httpOnly};
}

export function parseInput(text) {
  if (typeof text !== 'string' || !text.trim()) fail('請選擇檔案，或貼上 Cookie 資料。');
  if (new TextEncoder().encode(text).length > MAX_BYTES) fail('檔案上限為 5 MiB。');
  const source = text.replace(/^\uFEFF/, '');
  let entries;
  let format;
  if (/^[\s]*[\[{]/.test(source)) {
    let payload;
    try { payload = JSON.parse(source); } catch { fail('JSON 語法不正確，請檢查逗號、引號及括號。'); }
    const data = Array.isArray(payload) ? payload : (plain(payload) && Array.isArray(payload.cookies) ? payload.cookies : null);
    if (!data) fail('JSON 必須是 Cookie 陣列，或包含 cookies 陣列的物件。');
    format = 'JSON';
    entries = data.map((raw, index) => ({raw, source:index + 1}));
  } else {
    format = 'Netscape cookies.txt';
    entries = source.split(/\r?\n/).map((line, index) => ({line, source:index + 1}))
      .filter(({line}) => line.trim() && (!line.startsWith('#') || line.startsWith('#HttpOnly_')));
  }
  if (!entries.length) fail('找不到任何 Cookie。');
  if (entries.length > MAX_COOKIES) fail(`單次最多處理 ${MAX_COOKIES} 筆 Cookie。`);
  const rows = entries.map(entry => {
    try {
      const raw = format === 'JSON' ? entry.raw : netscapeLine(entry.line);
      return {source:entry.source, ...normalizeCookie(raw)};
    } catch (error) {
      // Avoid retaining invalid raw data or copying it into DOM error output.
      return {source:entry.source, error:error.message, notes:[]};
    }
  });
  return {format, rows, warnings:format === 'JSON' ? [] : ['cookies.txt 未保存 SameSite 與 partitionKey，無法還原這些屬性；建議使用本工具的 JSON 備份。']};
}

export function buildPreview(parsed, site, now = Date.now() / 1000) {
  const url = normalizeSite(site);
  const seen = new Set();
  return parsed.rows.map(row => {
    if (row.error) return {...row, status:'invalid', reason:row.error};
    const cookie = row.cookie;
    if (!matchesSite(cookie, url.hostname)) return {...row, status:'outside', reason:'不適用於目標主機，略過。'};
    if (!cookie.session && cookie.expirationDate <= now) return {...row, status:'expired', reason:'已過期，略過以避免刪除現有 Cookie。'};
    const key = cookieKey(cookie);
    if (seen.has(key)) return {...row, status:'duplicate', reason:'檔案內重複的 Cookie，只保留第一筆。'};
    seen.add(key);
    return {...row, status:'ready', reason:row.notes.length ? row.notes.join(' ') : '可匯入'};
  });
}

export function toSetDetails(cookie, site, now = Date.now() / 1000) {
  const url = normalizeSite(site);
  if (!matchesSite(cookie, url.hostname)) fail('Cookie 不適用於目標網站。');
  if (!cookie.session && cookie.expirationDate <= now) fail('Cookie 已過期，未寫入。');
  const scheme = cookie.secure ? 'https:' : url.protocol;
  // The API path is explicit, so URL only needs the exact host and a safe '/'.
  const result = {url:`${scheme}//${normalizeHost(cookie.domain)}/`, name:cookie.name, value:cookie.value,
    path:cookie.path, secure:cookie.secure, httpOnly:cookie.httpOnly, sameSite:cookie.sameSite};
  if (!cookie.hostOnly) result.domain = cookie.domain;
  if (!cookie.session) result.expirationDate = cookie.expirationDate;
  if (cookie.partitionKey) result.partitionKey = {...cookie.partitionKey};
  return result;
}

export function importOrigins(cookies, site) {
  return [...new Set(cookies.map(cookie => `${new URL(toSetDetails(cookie, site).url).origin}/*`))];
}

export function exportOrigins(site) {
  const host = normalizeSite(site).hostname;
  return [`https://${host}/*`, `http://${host}/*`];
}

export function makeJSON(cookies, site, scope = '未分割 Cookie') {
  return JSON.stringify({format:'cookie-bridge', version:1, exportedAt:new Date().toISOString(), site:normalizeSite(site).origin, scope,
    cookies:cookies.map(c => {
      const out = {domain:c.domain, hostOnly:c.hostOnly, path:c.path, secure:c.secure, httpOnly:c.httpOnly, sameSite:c.sameSite, session:c.session, name:c.name, value:c.value};
      if (!c.session && c.expirationDate !== undefined) out.expirationDate = c.expirationDate;
      if (c.partitionKey) out.partitionKey = {...c.partitionKey};
      return out;
    })}, null, 2) + '\n';
}

export function makeNetscape(cookies) {
  if (cookies.some(c => c.partitionKey)) fail('cookies.txt 無法保存分割 Cookie，請使用 JSON。');
  const lines = ['# Netscape HTTP Cookie File', '# Exported by Cookie Bridge. Contains secrets; keep private.', '# SameSite and partition metadata cannot be represented in this format.', ''];
  for (const c of cookies) {
    if ([c.domain,c.path,c.name,c.value].some(v => /[\t\r\n]/.test(v))) fail('Cookie 含有 cookies.txt 無法保存的字元，請使用 JSON。');
    lines.push([`${c.httpOnly ? '#HttpOnly_' : ''}${c.domain}`, c.hostOnly ? 'FALSE' : 'TRUE', c.path, c.secure ? 'TRUE' : 'FALSE', c.session ? '0' : Math.floor(c.expirationDate), c.name, c.value].join('\t'));
  }
  return lines.join('\n') + '\n';
}
