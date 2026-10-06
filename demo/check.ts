import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { createDemo } from './server.tsx';
import { evaluate } from '../src/server/engine/evaluate.ts';
import { loadSecrets, tagIndex } from '../src/server/engine/registry.ts';
import type { Durable } from '../src/shared/secret.ts';
import type { DemoInput, DemoView } from './protocol.ts';

const app = await createDemo();
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address === 'object');
const origin = `http://127.0.0.1:${address.port}`;
const request = (path: string, cookie = '', input?: unknown, extra: Record<string, string> = {}) =>
  fetch(origin + path, { method: input === undefined ? 'GET' : 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json', ...extra },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }) });
const cookieOf = (response: Response) => {
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie);
  assert.ok(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict'));
  return cookie.split(';')[0];
};
const visitor = async (cookie = '') => {
  const response = await request('/', cookie);
  const page = await response.text();
  assert.equal(response.status, 200);
  const scope = page.match(/data-scope="([a-f0-9]{32})"/)?.[1];
  assert.ok(scope);
  return { cookie: cookie || cookieOf(response), page, scope, sequence: Number(page.match(/data-sequence="(\d+)"/)?.[1]) };
};
const submit = async (v: Awaited<ReturnType<typeof visitor>>, payload: DemoInput): Promise<DemoView> => {
  const response = await request('/b', v.cookie, { ...payload, scope: v.scope, sequence: v.sequence + 1 });
  assert.equal(response.status, 200);
  const view = await response.json() as DemoView;
  v.sequence = view.sequence;
  return view;
};
try {
  const first = await visitor();
  const second = await visitor();
  assert.ok(!first.page.includes('data-island=') && !first.page.includes('example-machine'));
  assert.ok(!first.page.includes('Pocket Sunrise') && !first.page.includes('example.turn'));
  assert.equal((await request('/i/999999', first.cookie)).status, 404);
  assert.equal((await request('/b', '', {})).status, 401);
  assert.equal((await request('/b', first.cookie, {}, { Origin: 'https://elsewhere.test' })).status, 403);
  const foreignHost = await new Promise<number | undefined>((resolve, reject) => {
    const call = httpRequest(origin, { headers: { Host: 'elsewhere.test' } }, response => {
      response.resume(); resolve(response.statusCode);
    });
    call.on('error', reject); call.end();
  });
  assert.equal(foreignHost, 403);
  const base = { scope: first.scope, sequence: 1 };
  for (const payload of [{ input: 'x'.repeat(129) }, { report: 'x'.repeat(65) },
    { input: 'example', report: 'example.turn' }, { input: 'example', sequence: 1.5 }]) {
    assert.equal((await request('/b', first.cookie, { ...base, ...payload })).status, 400);
  }
  assert.equal((await request('/b', first.cookie, { ...base, input: 'x'.repeat(5000) })).status, 413);
  assert.equal((await request('/b', first.cookie, { ...base, report: 'example.turn' })).status, 404);
  assert.equal((await request('/b', second.cookie, { ...base, input: 'example' })).status, 409);
  const forged = await request('/b', first.cookie, { ...base, input: 'nothing', unlocked: [999999, 999998],
    durable: { money: 999, tally: { 'example.turns': 999 } } });
  const empty = await forged.json();
  assert.equal(empty.count, 0); assert.equal(empty.money, 0);
  assert.equal(empty.html, ''); assert.equal(empty.css, '');
  first.sequence = empty.sequence;
  const close = await submit(first, { input: 'demo' });
  assert.equal(close.count, 0); assert.match(close.feedback, /close/);
  assert.ok(!JSON.stringify(close).includes('Pocket Sunrise'));
  const unlocked = await submit(first, { input: 'EXAMPLE' });
  assert.equal(unlocked.count, 1); assert.equal(unlocked.total, 2);
  assert.match(unlocked.html, /data-island="999999"/);
  assert.match(unlocked.html, /data-slot="example.output"><\/div>/);
  assert.match(unlocked.css, /example-machine/);
  assert.ok(!unlocked.html.includes('Pocket Sunrise') && !unlocked.css.includes('example-sunrise'));
  assert.match(unlocked.hint, /handle/);
  assert.equal(unlocked.notices[0].name, 'An Example Machine');
  const island = await request('/i/999999', first.cookie);
  assert.equal(island.status, 200);
  assert.match(island.headers.get('cache-control') ?? '', /no-store/);
  const code = await island.text();
  assert.match(code, /example.turn/);
  assert.ok(!code.includes('Pocket Sunrise') && !code.includes('999998') && !code.includes('>=3'));
  assert.equal((await request('/i/999999', second.cookie)).status, 404);
  assert.equal((await request('/i/999998', first.cookie)).status, 404);
  assert.equal((await request('/dist/islands/999999.js', first.cookie)).status, 404);
  assert.match((await submit(first, { input: 'example' })).feedback, /already found/);
  const crank = { report: 'example.turn', scope: first.scope, sequence: first.sequence + 1 };
  const repeated = await Promise.all([request('/b', first.cookie, crank), request('/b', first.cookie, crank)]);
  for (const reply of repeated) {
    assert.equal(reply.status, 200);
    const view = await reply.json();
    assert.match(view.html, /1 turn remembered/); assert.equal(view.money, 0);
  }
  first.sequence = crank.sequence;
  const two = await submit(first, { report: 'example.turn' });
  assert.equal(two.count, 1); assert.match(two.html, /2 turns remembered/);
  assert.match((await visitor(first.cookie)).page, /2 turns remembered/);
  const winning = { scope: first.scope, sequence: first.sequence + 1, report: 'example.turn' };
  const wonResponses = await Promise.all([request('/b', first.cookie, winning), request('/b', first.cookie, winning)]);
  const won = await Promise.all(wonResponses.map(r => r.json()));
  for (const view of won) {
    assert.equal(view.count, 2); assert.equal(view.money, 5);
    assert.match(view.html, /data-slot="example.output"><div data-from="999998">/);
    assert.match(view.html, /Pocket Sunrise/); assert.match(view.css, /example-sunrise/);
    assert.equal(view.hint, '');
  }
  assert.equal(won.reduce((n, view) => n + view.notices.length, 0), 1);
  first.sequence = winning.sequence;
  assert.equal((await submit(first, { report: 'example.turn' })).money, 5);
  assert.equal((await request('/b', first.cookie, winning)).status, 409);
  const saved = await visitor(first.cookie);
  assert.match(saved.page, /Pocket Sunrise/); assert.match(saved.page, /5 demo tokens/);

  const secrets = await loadSecrets();
  const durable: Durable = { visits: 1, username: null, theme: null, shapes: [], solved: [],
    money: 0, inventory: {}, tally: { 'example.turns': 3 }, tallyAt: {}, placed: {}, vaulted: {}, bought: {}, hidden: [], carried: null };
  const now = new Date();
  const window = { events: [{ t: 'x' as const, k: 'example.turn', ts: now.getTime() }],
    ua: '', vw: 0, vh: 0, idle: 0, path: '/', scrolled: 0, below: 0, t0: now.getTime() };
  const refused = evaluate(secrets, window, new Set(), now, durable, tagIndex(secrets));
  assert.equal(refused.unlocked.length, 0); assert.equal(refused.early[0]?.kind, 'prerequisite');

  await submit(second, { input: 'example' });
  await submit(second, { report: 'example.turn' });
  const cleared = await request('/reset', first.cookie, { scope: first.scope });
  assert.equal(cleared.status, 204);
  const fresh = await visitor(cookieOf(cleared));
  assert.notEqual(fresh.cookie, first.cookie); assert.notEqual(fresh.scope, first.scope);
  assert.match(fresh.page, /0 of 2 discovered · 0 demo tokens/);
  assert.ok(!fresh.page.includes('Pocket Sunrise'));
  assert.equal((await request('/i/999999', first.cookie)).status, 404);
  assert.equal((await request('/b', first.cookie, winning)).status, 401);
  assert.equal((await request('/b', fresh.cookie, winning)).status, 409);
  assert.equal((await request('/reset', fresh.cookie, { scope: first.scope })).status, 409);
  assert.match((await visitor(second.cookie)).page, /1 turn remembered/);
  assert.equal((await request('/i/999999', second.cookie)).status, 200);
  assert.match((await submit(fresh, { input: 'example' })).html, /0 turns remembered/);
  for (let i = 0; i < 3; i++) await submit(fresh, { report: 'example.turn' });
  assert.match((await visitor(fresh.cookie)).page, /5 demo tokens/);
  const limited = await visitor();
  for (let i = 0; i < 60; i++) await submit(limited, { input: 'x' });
  assert.equal((await request('/b', limited.cookie, { input: 'x', scope: limited.scope, sequence: 61 })).status, 429);
  const shell = readFileSync('dist/demo/client.js', 'utf8');
  assert.ok(!shell.includes('999999') && !shell.includes('999998') && !shell.includes('example.turn') && !shell.includes('Pocket Sunrise'));
  assert.deepEqual(readdirSync('dist/islands'), ['999999.js']);
  console.log('Public demo passed: two-stage discovery, prerequisites, hints, near misses, gated nested content, persisted turns, atomic reward, concurrent retries, isolation, reset, stale commands, input limits and bundle separation.');
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
