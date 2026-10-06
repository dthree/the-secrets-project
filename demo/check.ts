import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { once } from 'node:events';
import { readFileSync, readdirSync } from 'node:fs';
import { createDemo } from './server.tsx';

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
try {
  const fresh = await request('/');
  const first = cookieOf(fresh);
  const page = await fresh.text();
  assert.equal(fresh.status, 200);
  assert.ok(!page.includes('data-island') && !page.includes('example-note'));
  assert.equal((await request('/i/999999', first)).status, 404);
  const second = cookieOf(await request('/'));
  assert.equal((await request('/b', '', { input: 'example' })).status, 401);
  assert.equal((await request('/b', first, { input: 'example', unlocked: [999999] }, { Origin: 'https://elsewhere.test' })).status, 403);
  const foreignHost = await new Promise<number | undefined>((resolve, reject) => {
    const call = httpRequest(origin, { headers: { Host: 'elsewhere.test' } }, response => {
      response.resume(); resolve(response.statusCode);
    });
    call.on('error', reject); call.end();
  });
  assert.equal(foreignHost, 403);
  assert.equal((await request('/b', first, { input: 'x'.repeat(129) })).status, 400);
  assert.equal((await request('/b', first, { input: 'x'.repeat(5000) })).status, 413);
  const forged = await (await request('/b', first, { input: 'nothing', unlocked: [999999] })).json();
  assert.equal(forged.count, 0);
  assert.equal(forged.html, '');
  assert.equal(forged.css, '');
  const unlocked = await (await request('/b', first, { input: 'example' })).json();
  assert.equal(unlocked.count, 1);
  assert.match(unlocked.html, /data-island="999999"/);
  assert.match(unlocked.css, /example-note/);
  const island = await request('/i/999999', first);
  assert.equal(island.status, 200);
  assert.match(island.headers.get('cache-control') ?? '', /no-store/);
  assert.match(await island.text(), /gated island mounted/);
  assert.equal((await request('/i/999999', second)).status, 404);
  assert.equal((await request('/i/999998', first)).status, 404);
  assert.equal((await request('/dist/islands/999999.js', first)).status, 404);
  assert.match(await (await request('/', first)).text(), /data-island="999999"/);
  assert.equal((await (await request('/b', first, { input: 'example' })).json()).count, 1);
  await request('/b', second, { input: 'example' });
  const cleared = await request('/reset', first, {});
  assert.equal(cleared.status, 204);
  const resetCookie = cookieOf(cleared);
  assert.notEqual(resetCookie, first);
  assert.equal((await request('/i/999999', resetCookie)).status, 404);
  assert.equal((await request('/i/999999', first)).status, 404);
  assert.equal((await request('/b', first, { input: 'example' })).status, 401);
  assert.equal((await request('/i/999999', second)).status, 200);
  assert.equal((await (await request('/b', resetCookie, { input: 'example' })).json()).count, 1);
  for (let i = 0; i < 59; i++) assert.equal((await request('/b', resetCookie, { input: 'x' })).status, 200);
  assert.equal((await request('/b', resetCookie, { input: 'x' })).status, 429);
  const shell = readFileSync('dist/demo/client.js', 'utf8');
  assert.ok(!shell.includes('999999') && !shell.includes('gated island mounted'));
  assert.deepEqual(readdirSync('dist/islands'), ['999999.js']);
  console.log('Public demo passed: delivery gates, forged ownership, repeat input, owner isolation, reset, stale requests, limits and bundle separation.');
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
