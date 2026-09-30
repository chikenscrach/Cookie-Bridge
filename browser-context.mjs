export class CookieContextError extends Error {
  constructor() {
    super('無法確認目前視窗的 Cookie 儲存區。請關閉此管理分頁，再從要操作的一般或無痕視窗點選擴充功能圖示。');
    this.name = 'CookieContextError';
  }
}

export function managerTabOptions(tab, managerURL, inIncognitoContext) {
  if (!tab || !Number.isInteger(tab.windowId) || tab.windowId < 0 ||
      typeof tab.incognito !== 'boolean' || typeof inIncognitoContext !== 'boolean' ||
      tab.incognito !== inIncognitoContext) throw new CookieContextError();
  const page = new URL(managerURL);
  try {
    const source = new URL(tab.url);
    if (['https:', 'http:'].includes(source.protocol)) page.searchParams.set('site', source.origin);
  } catch { /* The user can type a website in the manager. */ }
  // Pin the new tab to the clicked window, even if focus changes asynchronously.
  return {url:page.href, windowId:tab.windowId, active:true};
}

export async function resolveCookieContext(api) {
  try {
    const incognito = api.extension.inIncognitoContext;
    // Use this manager tab, not the globally active tab or a URL/file parameter.
    const tab = await api.tabs.getCurrent();
    if (typeof incognito !== 'boolean' || !Number.isInteger(tab?.id) || tab.id < 0 ||
        tab.incognito !== incognito) throw new CookieContextError();
    const stores = await api.cookies.getAllCookieStores();
    const matches = stores.filter(store => Array.isArray(store.tabIds) && store.tabIds.includes(tab.id));
    if (matches.length !== 1 || typeof matches[0].id !== 'string' || !matches[0].id.trim()) throw new CookieContextError();
    return Object.freeze({tabId:tab.id, storeId:matches[0].id, incognito});
  } catch { throw new CookieContextError(); }
}

export async function revalidateCookieContext(api, previous) {
  const current = await resolveCookieContext(api);
  if (!previous || previous.tabId !== current.tabId || previous.storeId !== current.storeId ||
      previous.incognito !== current.incognito) throw new CookieContextError();
  return current;
}
