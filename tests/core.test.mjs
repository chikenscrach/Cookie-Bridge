import test from 'node:test';
import assert from 'node:assert/strict';
import {parseInput,normalizeCookie,normalizeHost,normalizeSite,buildPreview,toSetDetails,cookieKey,matchesSite,importOrigins,exportOrigins,makeJSON,makeNetscape,MAX_BYTES,MAX_COOKIES} from '../core.mjs';
import {importCookies,readForExport} from '../cookie-api.mjs';

const STORE = 'profile-main-42';
const FUTURE = Date.now()/1000 + 86400;
const fixture = (extra = {}) => ({domain:'example.com', hostOnly:true, path:'/', secure:true, httpOnly:true,
  name:'__Host-session', value:'test-only=abc==', sameSite:'lax', session:false, expirationDate:FUTURE, ...extra});
const normalized = extra => normalizeCookie(fixture(extra)).cookie;
const parse = input => parseInput(JSON.stringify(input));
const fakeAPI = (initial = []) => {
  const jar = initial.map(c => ({storeId:STORE,...c}));
  const calls = [];
  return {jar, calls, cookies:{
    async getAll(query) {
      calls.push(['getAll', query]);
      assert.equal(query.storeId, STORE);
      return jar.filter(c => c.storeId === query.storeId && (!query.domain || normalizeHost(c.domain) === query.domain || normalizeHost(c.domain).endsWith('.'+query.domain)) &&
        (query.name === undefined || c.name === query.name) && (!query.path || c.path === query.path) &&
        (query.partitionKey ? c.partitionKey?.topLevelSite === query.partitionKey.topLevelSite &&
          (query.partitionKey.hasCrossSiteAncestor === undefined || (c.partitionKey.hasCrossSiteAncestor ?? false) === query.partitionKey.hasCrossSiteAncestor) : !c.partitionKey));
    },
    async set(details) {
      calls.push(['set', details]);
      assert.equal(details.storeId, STORE);
      const cookie = {...details, domain:details.domain ?? new URL(details.url).hostname, hostOnly:!details.domain, session:details.expirationDate === undefined};
      const at = jar.findIndex(c => c.storeId === details.storeId && cookieKey(c) === cookieKey(cookie));
      if (at >= 0) jar.splice(at,1);
      jar.push(cookie); return cookie;
    }
  }};
};

test('Netscape preserves HttpOnly, leading-dot domain, flags, equals signs and empty values', () => {
  const source = '\uFEFF# Netscape HTTP Cookie File\r\n#HttpOnly_.example.com\tTRUE\t/\tTRUE\t0\tsession.0\tabc==\r\nexample.com\tFALSE\t/sub\tFALSE\t0\tempty\t\r\n';
  const parsed = parseInput(source);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].cookie.value,'abc==');
  assert.equal(parsed.rows[0].cookie.httpOnly,true);
  assert.equal(parsed.rows[0].cookie.hostOnly,false);
  assert.equal(parsed.rows[0].cookie.session,true);
  assert.equal(parsed.rows[1].cookie.value,'');
  assert.equal(parsed.rows[1].cookie.hostOnly,true);
  assert.equal(parsed.rows[1].cookie.path,'/sub');
  assert.equal(parsed.rows[0].cookie.sameSite,'unspecified');
  assert.equal(parsed.warnings.length,1);
});

test('Netscape uses the include-subdomains column, not the leading dot, for hostOnly', () => {
  const cookie = parseInput('.example.com\tFALSE\t/\tTRUE\t0\t__Host-token\tx').rows[0].cookie;
  assert.equal(cookie.hostOnly,true); assert.equal(cookie.domain,'example.com');
});

test('Netscape rejects malformed columns, flags, expiry and whitespace-delimited headers', () => {
  for (const source of [
    'example.com TRUE / TRUE 0 foo bar',
    'example.com\tMAYBE\t/\tTRUE\t0\tfoo\tbar',
    'example.com\tFALSE\t/\tTRUE\tnan\tfoo\tbar',
    'Cookie: session=do-not-print-this',
    'example.com\tFALSE\t/\tTRUE\t0\tfoo\tbar\textra'
  ]) {
    const parsed = parseInput(source); assert.ok(parsed.rows[0].error);
    assert.ok(!parsed.rows[0].error.includes('do-not-print-this'));
  }
});

test('JSON accepts arrays and wrapped arrays, reports bad rows separately', () => {
  for (const value of [[fixture(),null], {cookies:[fixture(),null]}]) {
    const parsed = parse(value); assert.equal(parsed.rows.length,2);
    assert.ok(parsed.rows[0].cookie); assert.ok(parsed.rows[1].error);
  }
});

test('JSON syntax errors never echo the source value', () => {
  assert.throws(() => parseInput('[{"name":"secret-value-never-show"'), error => !error.message.includes('secret-value-never-show'));
});

test('rejects unsupported JSON shape, empty files, huge files and too many entries', () => {
  for (const value of ['', '  ', '# just comments', '[]', '{}', '{"session":"secret"}']) assert.throws(() => parseInput(value));
  assert.throws(() => parseInput('x'.repeat(MAX_BYTES+1)), /5 MiB/);
  assert.throws(() => parse(Array(MAX_COOKIES+1).fill(null)), /最多/);
});

test('sameSite maps supported spellings and rejects inherited object keys', () => {
  for (const sameSite of ['None','none','no_restriction']) assert.equal(normalized({sameSite}).sameSite,'no_restriction');
  for (const sameSite of ['Lax','lax']) assert.equal(normalized({sameSite}).sameSite,'lax');
  for (const sameSite of ['__proto__','constructor',false,'other']) assert.throws(() => normalized({sameSite}), /SameSite/);
});

test('preserves explicit boolean false and refuses coercion of string booleans', () => {
  assert.equal(normalized({name:'pref',httpOnly:false}).httpOnly,false);
  for (const field of ['secure','httpOnly','hostOnly','session']) assert.throws(() => normalized({[field]:'false'}), /true 或 false/);
});

test('validates all security prefixes without silently changing scope', () => {
  assert.throws(() => normalized({name:'__Secure-a',secure:false}), /Secure/);
  assert.throws(() => normalized({hostOnly:false}), /__Host-/);
  assert.throws(() => normalized({path:'/sub'}), /__Host-/);
  assert.throws(() => normalized({name:'__Http-a',httpOnly:false}), /HttpOnly/);
  assert.throws(() => normalized({name:'__Host-Http-a',httpOnly:false}), /HttpOnly/);
  assert.throws(() => normalized({name:'plain',sameSite:'None',secure:false}), /SameSite=None/);
});

test('supports explicit JSON partition keys and keeps cross-site-ancestor state', () => {
  const cookie = normalized({partitionKey:{topLevelSite:'https://top.example',hasCrossSiteAncestor:true}});
  assert.deepEqual(toSetDetails(cookie,'https://example.com').partitionKey,cookie.partitionKey);
  for (const key of [{}, {topLevelSite:'https://top.example/path'}, {topLevelSite:'https://top.example:444'}, {topLevelSite:'file:///tmp/a'}, {topLevelSite:'https://top.example',hasCrossSiteAncestor:'true'}]) {
    assert.throws(() => normalized({partitionKey:key}));
  }
  assert.throws(() => normalized({partitioned:true}), /缺少 partitionKey/);
  assert.throws(() => normalized({name:'a',secure:false,partitionKey:{topLevelSite:'https://top.example',hasCrossSiteAncestor:true}}), /Secure/);
});

test('legacy partition keys without the ancestor bit are rejected rather than guessed', () => {
  assert.throws(() => normalized({partitionKey:{topLevelSite:'https://top.example'}}), /hasCrossSiteAncestor/);
});

test('does not silently import Firefox first-party partition state', () => {
  assert.throws(() => normalized({firstPartyDomain:'example.org'}), /firstPartyDomain/);
});

test('expiry accepts Chrome session semantics and prevents accidental deletion', () => {
  assert.equal(normalized({session:true}).expirationDate,undefined);
  assert.equal(normalized({session:true}).session,true);
  const raw = fixture(); delete raw.session; raw.expirationDate = -1;
  assert.equal(normalizeCookie(raw).cookie.session,true);
  assert.throws(() => normalized({expirationDate:Date.now()}), /毫秒/);
  const absent = fixture(); delete absent.expirationDate;
  assert.throws(() => normalizeCookie(absent), /到期/);
  assert.equal(buildPreview(parse([fixture({expirationDate:0})]),'https://example.com')[0].status,'expired');
});

test('rejects malicious host syntax, does not turn domains into arbitrary URLs', () => {
  for (const domain of ['https://example.com','example.com@evil.test','*.example.com','example.com/path','example.com:443','example.com\\evil.test','example.com?x','example..com','.',' example.com','example.com.']) assert.throws(() => normalizeHost(domain));
  assert.equal(normalizeHost('.EXAMPLE.com'),'example.com');
  assert.equal(normalizeHost('測試.tw'),'xn--g6w251d.tw');
});

test('target normalization supports bare domains and rejects non-web schemes or userinfo', () => {
  assert.equal(normalizeSite('example.com/path').origin,'https://example.com');
  assert.equal(normalizeSite('http://localhost:8080').port,'8080');
  for (const site of ['file:///tmp/x','chrome://settings','https://user:secret@example.com']) assert.throws(() => normalizeSite(site));
});

test('domain matching respects label boundaries and host-only cookies', () => {
  assert.equal(matchesSite(normalized({name:'x',hostOnly:false}),'sub.example.com'),true);
  assert.equal(matchesSite(normalized(),'sub.example.com'),false);
  assert.equal(matchesSite(normalized({name:'x',hostOnly:false}),'evil-example.com'),false);
});

test('preview skips expired, unrelated and duplicate cookies while keeping chunks and paths', () => {
  const data = [fixture(),fixture(),fixture({expirationDate:1}),fixture({domain:'other.test'}),
    fixture({name:'session.0'}),fixture({name:'session.1'}),fixture({name:'session.0',path:'/sub'})];
  assert.deepEqual(buildPreview(parse(data),'https://example.com').map(r=>r.status),['ready','duplicate','expired','outside','ready','ready','ready']);
});

test('different partition keys remain different cookie identities', () => {
  const regular = normalized();
  const same = normalized({partitionKey:{topLevelSite:'https://top.example',hasCrossSiteAncestor:false}});
  const cross = normalized({partitionKey:{topLevelSite:'https://top.example',hasCrossSiteAncestor:true}});
  assert.equal(new Set([regular,same,cross].map(cookieKey)).size,3);
});

test('host-only API details omit Domain and do not copy storeId', () => {
  const cookie = normalizeCookie(fixture({storeId:'1'})).cookie;
  const details = toSetDetails(cookie,'http://example.com');
  assert.equal(details.url,'https://example.com/');
  assert.ok(!Object.hasOwn(details,'domain')); assert.ok(!Object.hasOwn(details,'storeId'));
  assert.equal(details.value,'test-only=abc==');
  assert.equal(toSetDetails(normalized({name:'a',hostOnly:false}),'https://sub.example.com').domain,'.example.com');
  assert.throws(() => toSetDetails(cookie,'https://evil-example.com'));
});

test('only exact necessary hosts are requested at import time', () => {
  assert.deepEqual(importOrigins([normalized(),normalized({name:'b'})],'https://example.com'),['https://example.com/*']);
  assert.deepEqual(exportOrigins('https://example.com/path'),['https://example.com/*','http://example.com/*']);
});

test('Cookie header delimiters, controls and oversize credentials are rejected', () => {
  for (const patch of [{name:'bad name'},{name:'bad;name'},{value:'x\r\ny'},{value:'x;y'},{value:' x '},{value:'x'.repeat(4097)},{path:'/'+'\n'}]) assert.throws(() => normalized(patch));
  assert.throws(() => normalized({name:'',value:'x=y'}));
});

test('JSON roundtrip preserves values, all supported attributes, and partition state', () => {
  const cookies = [normalized(), normalized({name:'p',hostOnly:false,partitionKey:{topLevelSite:'https://top.example',hasCrossSiteAncestor:true}}), normalized({name:'s',session:true})];
  const parsed = parseInput(makeJSON(cookies,'https://example.com'));
  assert.deepEqual(parsed.rows.map(r=>r.cookie),cookies);
  assert.ok(!makeJSON(cookies,'https://example.com').includes('storeId'));
});

test('cookies.txt roundtrip preserves its fields and refuses partitioned export', () => {
  const cookie = normalized({name:'plain',expirationDate:Math.floor(FUTURE)});
  const again = parseInput(makeNetscape([cookie])).rows[0].cookie;
  assert.deepEqual({...again,sameSite:'lax'},cookie);
  assert.throws(() => makeNetscape([normalized({partitionKey:{topLevelSite:'https://top.example',hasCrossSiteAncestor:true}})]),/JSON/);
});

test('import writes and reads back HttpOnly cookies; chunks are not joined', async () => {
  const api = fakeAPI();
  const cookies = [normalized({name:'__Secure-next-auth.session-token.0'}),normalized({name:'__Secure-next-auth.session-token.1'})];
  const result = await importCookies(api,cookies,'https://example.com',{storeId:STORE});
  assert.deepEqual(result.map(r=>r.status),['success','success']);
  assert.equal(api.jar.length,2); assert.ok(api.jar.every(c=>c.httpOnly));
  assert.ok(!JSON.stringify(result).includes('test-only=abc=='));
});

test('skip mode never overwrites an existing matching cookie or touches unrelated cookies', async () => {
  const old = normalized({value:'old-secret'});
  const unrelated = normalized({domain:'other.test'});
  const api = fakeAPI([old,unrelated]);
  const result = await importCookies(api,[normalized()],'https://example.com',{storeId:STORE,overwrite:false});
  assert.equal(result[0].status,'skipped'); assert.equal(api.jar[0].value,'old-secret');
  assert.equal(api.calls.filter(([kind])=>kind==='set').length,0);
  assert.deepEqual(api.jar[1],{storeId:STORE,...unrelated});
});

test('replace mode only changes the matching cookie and identifies expiration clamping', async () => {
  const api = fakeAPI([normalized({value:'old'}),normalized({name:'unrelated'})]);
  const set = api.cookies.set;
  api.cookies.set = details => set({...details,expirationDate:details.expirationDate-100});
  const result = await importCookies(api,[normalized()],'https://example.com',{storeId:STORE});
  assert.equal(result[0].status,'adjusted'); assert.equal(api.jar.length,2);
  assert.match(result[0].message,/到期時間/);
});

test('import rechecks expiry after preview and never calls set for an expired cookie', async () => {
  const api = fakeAPI();
  const result = await importCookies(api,[normalized({expirationDate:1})],'https://example.com',{storeId:STORE});
  assert.equal(result[0].status,'failed'); assert.equal(api.jar.length,0);
  assert.equal(api.calls.length,0);
});

test('readback mismatch reports failure; API exceptions do not leak values and later rows continue', async () => {
  const api = fakeAPI(); let count=0;
  api.cookies.set = async () => { if (++count===1) throw new Error('error secret-value=abc'); return {storeId:STORE}; };
  const result = await importCookies(api,[normalized(),normalized({name:'next'})],'https://example.com',{storeId:STORE});
  assert.deepEqual(result.map(r=>r.status),['failed','failed']);
  assert.ok(!JSON.stringify(result).includes('secret-value=abc'));
  assert.match(result[1].message,/讀回不符/);
});

test('export reads all paths on the exact host, excluding subdomains and other sites', async () => {
  const api = fakeAPI([normalized(),normalized({name:'otherpath',path:'/account'}),normalized({domain:'sub.example.com'}),normalized({domain:'other.test'})]);
  const cookies = await readForExport(api,'https://example.com','',{storeId:STORE});
  assert.equal(cookies.length,2);
  assert.ok(cookies.some(c=>c.path==='/account'));
  assert.ok(api.calls.every(([,query])=>query.domain==='example.com'));
});

test('export partition scope is explicit and preserves both ancestor modes', async () => {
  const top = 'https://top.example';
  const cookies = [normalized(),... [true,false].map(hasCrossSiteAncestor=>normalized({partitionKey:{topLevelSite:top,hasCrossSiteAncestor}}))];
  const api = fakeAPI(cookies);
  assert.equal((await readForExport(api,'https://example.com','',{storeId:STORE})).length,1);
  assert.equal((await readForExport(api,'https://example.com',top,{storeId:STORE})).length,3);
});
