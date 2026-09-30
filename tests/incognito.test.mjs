import test from 'node:test';
import assert from 'node:assert/strict';
import {CookieContextError, managerTabOptions, resolveCookieContext, revalidateCookieContext} from '../browser-context.mjs';
import {importCookies, readForExport} from '../cookie-api.mjs';
import {normalizeCookie, normalizeHost, cookieKey, parseInput, makeJSON} from '../core.mjs';
import {readFile} from 'node:fs/promises';

const NORMAL = 'profile-A';
const PRIVATE = 'private-session-Z9';
const PRIVATE_TAB = 802;
const NORMAL_TAB = 301;
const cookie = (value = 'test-only', extra = {}) => normalizeCookie({name:'__Host-demo',value,domain:'example.com',hostOnly:true,path:'/',secure:true,httpOnly:true,sameSite:'lax',session:true,...extra}).cookie;

function contextAPI({incognito = true, tabId = PRIVATE_TAB, stores} = {}) {
  return {
    extension:{inIncognitoContext:incognito},
    tabs:{getCurrent:async () => ({id:tabId,incognito})},
    cookies:{getAllCookieStores:async () => stores ?? [{id:NORMAL,tabIds:[NORMAL_TAB]},{id:PRIVATE,tabIds:[PRIVATE_TAB]}]}
  };
}

function twoStores() {
  const api = contextAPI();
  const jars = new Map([[NORMAL,new Map()],[PRIVATE,new Map()]]);
  const calls = [];
  function put(storeId, item) {
    const stored = {...item,storeId};
    jars.get(storeId).set(cookieKey(stored),stored);
  }
  api.cookies.getAll = async query => {
    assert.ok(jars.has(query.storeId), 'Every read must name an existing store');
    calls.push({method:'getAll',storeId:query.storeId});
    return [...jars.get(query.storeId).values()].filter(c =>
      (!query.domain || normalizeHost(c.domain) === query.domain) &&
      (query.name === undefined || c.name === query.name) &&
      (!query.path || c.path === query.path) &&
      (query.partitionKey ? c.partitionKey?.topLevelSite === query.partitionKey.topLevelSite && c.partitionKey?.hasCrossSiteAncestor === query.partitionKey.hasCrossSiteAncestor : !c.partitionKey));
  };
  api.cookies.set = async details => {
    assert.ok(jars.has(details.storeId), 'Every write must name an existing store');
    calls.push({method:'set',storeId:details.storeId});
    const item = {...details,domain:details.domain ?? new URL(details.url).hostname,hostOnly:!details.domain,session:details.expirationDate === undefined};
    put(details.storeId,item); return item;
  };
  return {api,jars,calls,put};
}

test('manifest opts into split mode without new permissions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.incognito,'split');
  assert.deepEqual(manifest.permissions,['cookies','activeTab']);
  assert.equal(manifest.version,'1.1.0');
});

test('manager opens inside the clicked window and only carries the site origin', () => {
  for (const incognito of [true,false]) {
    const result = managerTabOptions({windowId:43,incognito,url:'https://example.com/private?token=not-for-url#secret'},'chrome-extension://demo/manager.html',incognito);
    assert.equal(result.windowId,43); assert.equal(result.active,true);
    assert.equal(new URL(result.url).searchParams.get('site'),'https://example.com');
    assert.ok(!result.url.includes('token'));
    assert.ok(!result.url.includes('storeId'));
  }
});

test('closed or mismatched windows never fall back to another window', () => {
  for (const tab of [{incognito:true}, {windowId:-1,incognito:true}, {windowId:7,incognito:false}]) {
    assert.throws(() => managerTabOptions(tab,'chrome-extension://demo/manager.html',true),CookieContextError);
  }
});

test('store detection uses the manager tab membership and supports opaque store IDs', async () => {
  const privateContext = await resolveCookieContext(contextAPI());
  assert.deepEqual(privateContext,{tabId:PRIVATE_TAB,storeId:PRIVATE,incognito:true});
  assert.ok(Object.isFrozen(privateContext));
  const normal = await resolveCookieContext(contextAPI({incognito:false,tabId:NORMAL_TAB}));
  assert.deepEqual(normal,{tabId:NORMAL_TAB,storeId:NORMAL,incognito:false});
});

test('focus changes in another window cannot select another cookie store', async () => {
  const api = contextAPI();
  api.tabs.query = async () => { throw new Error('Must never select the globally active tab'); };
  assert.equal((await resolveCookieContext(api)).storeId,PRIVATE);
});

test('missing, ambiguous or invalid membership blocks all cookie access', async () => {
  for (const stores of [[],[{id:NORMAL,tabIds:[NORMAL_TAB]}],[{id:PRIVATE,tabIds:[PRIVATE_TAB]},{id:NORMAL,tabIds:[PRIVATE_TAB]}],[{id:'',tabIds:[PRIVATE_TAB]}]]) {
    await assert.rejects(resolveCookieContext(contextAPI({stores})),CookieContextError);
  }
  const api = contextAPI(); api.tabs.getCurrent = async () => undefined;
  await assert.rejects(resolveCookieContext(api),CookieContextError);
});

test('a disagreement between the tab and split-process mode is rejected', async () => {
  const api = contextAPI(); api.tabs.getCurrent = async () => ({id:PRIVATE_TAB,incognito:false});
  await assert.rejects(resolveCookieContext(api),CookieContextError);
  api.extension.inIncognitoContext = undefined;
  await assert.rejects(resolveCookieContext(api),CookieContextError);
});

test('store detection errors are sanitized and never select a default store', async () => {
  const api = contextAPI();
  api.cookies.getAllCookieStores = async () => { throw new Error('raw secret'); };
  await assert.rejects(resolveCookieContext(api),error => error instanceof CookieContextError && !error.message.includes('raw secret'));
});

test('context revalidation stops a changed store, tab or browsing mode', async () => {
  const api = contextAPI();
  const before = await resolveCookieContext(api);
  assert.deepEqual(await revalidateCookieContext(api,before),before);
  for (const change of [{storeId:NORMAL},{tabId:NORMAL_TAB},{incognito:false}]) {
    await assert.rejects(revalidateCookieContext(api,{...before,...change}),CookieContextError);
  }
});

test('missing destination store stops import and export before any API read or write', async () => {
  const {api,calls} = twoStores();
  for (const storeId of [undefined,null,'', ' ',0]) {
    await assert.rejects(importCookies(api,[cookie()],'https://example.com',{storeId}),/儲存區/);
    await assert.rejects(readForExport(api,'https://example.com','',{storeId}),/儲存區/);
  }
  assert.equal(calls.length,0);
});

test('private import, existence checks and readback use only the private store', async () => {
  const {api,jars,calls,put} = twoStores();
  put(NORMAL,cookie('normal-old')); put(PRIVATE,cookie('private-old'));
  const context = await resolveCookieContext(api);
  const result = await importCookies(api,[cookie('private-new')],'https://example.com',{storeId:context.storeId});
  assert.equal(result[0].status,'success');
  assert.equal([...jars.get(NORMAL).values()][0].value,'normal-old');
  assert.equal([...jars.get(PRIVATE).values()][0].value,'private-new');
  assert.ok(calls.length >= 2 && calls.every(c=>c.storeId===PRIVATE));
});

test('skip existing checks private cookies, ignoring identical normal cookies', async () => {
  const {api,jars,calls,put} = twoStores();
  put(NORMAL,cookie('normal-old'));
  const first = await importCookies(api,[cookie('private-new')],'https://example.com',{storeId:PRIVATE,overwrite:false});
  assert.equal(first[0].status,'success');
  const second = await importCookies(api,[cookie('private-replacement')],'https://example.com',{storeId:PRIVATE,overwrite:false});
  assert.equal(second[0].status,'skipped');
  assert.equal([...jars.get(PRIVATE).values()][0].value,'private-new');
  assert.equal([...jars.get(NORMAL).values()][0].value,'normal-old');
  assert.ok(calls.every(c=>c.storeId===PRIVATE));
});

test('normal import cannot change private cookies with the same identity', async () => {
  const {api,jars,calls,put} = twoStores();
  put(PRIVATE,cookie('private-old'));
  const result = await importCookies(api,[cookie('normal-new')],'https://example.com',{storeId:NORMAL});
  assert.equal(result[0].status,'success');
  assert.equal([...jars.get(PRIVATE).values()][0].value,'private-old');
  assert.ok(calls.every(c=>c.storeId===NORMAL));
});

test('source JSON storeId never overrides the destination context', async () => {
  const {api,jars,calls} = twoStores();
  const parsed = parseInput(JSON.stringify([{...cookie('portable'),storeId:NORMAL}]));
  assert.equal(parsed.rows[0].cookie.storeId,undefined);
  const result = await importCookies(api,[parsed.rows[0].cookie],'https://example.com',{storeId:PRIVATE});
  assert.equal(result[0].status,'success');
  assert.equal(jars.get(NORMAL).size,0);
  assert.ok(calls.every(c=>c.storeId===PRIVATE));
});

test('private export preserves partitions but reads no normal cookie values', async () => {
  const {api,calls,put} = twoStores();
  for (const [storeId,prefix] of [[NORMAL,'normal'],[PRIVATE,'private']]) {
    put(storeId,cookie(`${prefix}-plain`));
    for (const hasCrossSiteAncestor of [false,true]) put(storeId,cookie(`${prefix}-partition-${hasCrossSiteAncestor}`,{partitionKey:{topLevelSite:'https://top.example',hasCrossSiteAncestor}}));
  }
  const exported = await readForExport(api,'https://example.com','https://top.example',{storeId:PRIVATE});
  assert.equal(exported.length,3);
  assert.ok(exported.every(c=>c.value.startsWith('private-')));
  assert.equal(calls.length,3); assert.ok(calls.every(c=>c.storeId===PRIVATE));
  const text = makeJSON(exported,'https://example.com','無痕視窗 / 測試');
  assert.ok(!text.includes('normal-') && !text.includes('storeId'));
});

test('a returned cookie from another store is never accepted as write verification', async () => {
  const {api} = twoStores();
  api.cookies.set = async () => ({...cookie(),storeId:NORMAL});
  const result = await importCookies(api,[cookie()],'https://example.com',{storeId:PRIVATE});
  assert.equal(result[0].status,'failed');
  assert.match(result[0].message,/儲存區/);
});

test('readback and export discard unexpected records from another store', async () => {
  const {api} = twoStores();
  api.cookies.getAll = async () => [{...cookie(),storeId:NORMAL}];
  assert.equal((await readForExport(api,'https://example.com','',{storeId:PRIVATE})).length,0);
  const result = await importCookies(api,[cookie()],'https://example.com',{storeId:PRIVATE});
  assert.equal(result[0].status,'failed');
  assert.match(result[0].message,/讀回不符/);
});
