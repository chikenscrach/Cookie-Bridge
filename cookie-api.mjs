import {normalizeSite, normalizeHost, matchesSite, cookieKey, toSetDetails} from './core.mjs';

function safeAPIError(error) {
  const message = String(error?.message ?? '');
  if (/store|儲存區/i.test(message)) return '無法存取指定的 Cookie 儲存區，請從目標視窗重新開啟工具。';
  if (/permission|host permission|access/i.test(message)) return '缺少網站存取權限，請重新授權。';
  if (/partition/i.test(message)) return '瀏覽器拒絕分割資訊，請確認 topLevelSite 與瀏覽器版本。';
  if (/expired|過期/i.test(message)) return 'Cookie 已過期，未寫入。';
  if (/domain|public suffix/i.test(message)) return '瀏覽器拒絕此 Domain；不可使用公共後綴或不相符的網域。';
  return '瀏覽器拒絕操作，請確認 Cookie 屬性與網站權限。';
}

function requireStoreId(storeId) {
  if (typeof storeId !== 'string' || !storeId.trim()) throw new Error('尚未確認 Cookie 儲存區，操作已停止。');
}

async function exactMatches(api, cookie, storeId) {
  const details = {domain:normalizeHost(cookie.domain), name:cookie.name, path:cookie.path, storeId};
  if (cookie.partitionKey) details.partitionKey = {...cookie.partitionKey};
  return (await api.cookies.getAll(details)).filter(c => c.storeId === storeId && cookieKey(c) === cookieKey(cookie));
}

function changes(wanted, actual) {
  const changed = [];
  for (const field of ['hostOnly','secure','httpOnly','sameSite','session']) {
    if (wanted[field] !== actual[field]) changed.push(field);
  }
  if (!wanted.session && Math.abs((wanted.expirationDate ?? 0) - (actual.expirationDate ?? 0)) > 2) changed.push('到期時間');
  return changed;
}

export async function importCookies(api, cookies, site, {storeId, overwrite = true, onProgress = () => {}} = {}) {
  requireStoreId(storeId);
  normalizeSite(site);
  const results = [];
  for (let index = 0; index < cookies.length; index++) {
    const cookie = cookies[index];
    const row = {name:cookie.name, domain:cookie.domain, path:cookie.path, status:'failed', message:''};
    try {
      if (!matchesSite(cookie, normalizeSite(site).hostname)) throw new Error('domain mismatch');
      // Recheck expiry at the time of writing, even after the preview was open a while.
      const details = {...toSetDetails(cookie, site), storeId};
      if (!overwrite && (await exactMatches(api, cookie, storeId)).length) {
        row.status = 'skipped';
        row.message = '已存在，依設定略過。';
      } else {
        const written = await api.cookies.set(details);
        if (!written) throw new Error('write rejected');
        if (written.storeId !== storeId) throw new Error('cookie store mismatch');
        const persisted = (await exactMatches(api, cookie, storeId)).find(c => c.value === cookie.value);
        if (!persisted) {
          row.message = '寫入後讀回不符；可能已被網站或瀏覽器改寫。';
        } else {
          const adjusted = changes(cookie, persisted);
          row.status = adjusted.length ? 'adjusted' : 'success';
          row.message = adjusted.length ? `已寫入並讀回；瀏覽器調整了：${adjusted.join('、')}。` : '已寫入並讀回確認。';
        }
      }
    } catch (error) { row.message = safeAPIError(error); }
    results.push(row);
    onProgress(row, index + 1, cookies.length);
  }
  return results;
}

export async function readForExport(api, site, topLevelSite = '', {storeId} = {}) {
  requireStoreId(storeId);
  const host = normalizeSite(site).hostname;
  // Query an exact domain and all paths. Do not enumerate other permitted sites.
  const regular = (await api.cookies.getAll({domain:host, storeId})).filter(c => !c.partitionKey);
  const combined = [...regular];
  if (topLevelSite.trim()) {
    const partition = normalizeSite(topLevelSite).origin;
    for (const hasCrossSiteAncestor of [false, true]) {
      combined.push(...await api.cookies.getAll({domain:host, storeId, partitionKey:{topLevelSite:partition, hasCrossSiteAncestor}}));
    }
  }
  const unique = new Map();
  for (const cookie of combined) {
    if (cookie.storeId === storeId && normalizeHost(cookie.domain) === host) unique.set(cookieKey(cookie), cookie);
  }
  return [...unique.values()].sort((a,b) => a.domain.localeCompare(b.domain) || a.path.localeCompare(b.path) || a.name.localeCompare(b.name));
}
