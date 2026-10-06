import express from 'express';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSecrets, tagIndex } from '../src/server/engine/registry.ts';
import { evaluate } from '../src/server/engine/evaluate.ts';
import { compose } from '../src/server/engine/compose.ts';
import type { Durable, SlotCtx } from '../src/shared/secret.ts';

export async function createDemo() {
  const secrets = await loadSecrets();
  const tagged = tagIndex(secrets);
  const byNumber = new Map(secrets.map(secret => [secret.manifest.n, secret]));
  const islands = new Map(secrets.filter(s => s.module.hasIsland).map(s =>
    [s.manifest.n, readFileSync(resolve('dist/islands', `${s.manifest.n}.js`), 'utf8')]));
  const client = readFileSync(resolve('dist/demo/client.js'), 'utf8');
  type Session = { unlocked: Set<number>; expires: number; requests: number; window: number };
  const sessions = new Map<string, Session>();
  const lifetime = 30 * 60_000;
  const cookieId = (req: express.Request) => req.headers.cookie?.match(/(?:^|;\s*)demo=([a-f0-9]{64})(?:;|$)/)?.[1];
  const sessionOf = (req: express.Request) => {
    const id = cookieId(req);
    const session = id ? sessions.get(id) : undefined;
    if (session && session.expires > Date.now()) return session;
    if (id) sessions.delete(id);
    return undefined;
  };
  const newSession = (res: express.Response): Session | undefined => {
    const now = Date.now();
    for (const [id, s] of sessions) if (s.expires <= now) sessions.delete(id);
    if (sessions.size >= 1000) { res.status(503).send('Demo session limit reached.'); return; }
    const session = { unlocked: new Set<number>(), expires: now + lifetime, requests: 0, window: now };
    const id = randomBytes(32).toString('hex');
    sessions.set(id, session);
    res.cookie('demo', id, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: lifetime });
    return session;
  };
  const durable = (): Durable => ({ visits: 1, username: null, theme: null, shapes: [], solved: [],
    money: 0, inventory: {}, tally: {}, tallyAt: {}, placed: {}, vaulted: {}, bought: {}, hidden: [], carried: null });
  const projection = (session: Session) => {
    const ctx: SlotCtx = { durable: durable(), boards: [], farm: [], mine: session.unlocked.size,
      total: secrets.length, signedIn: false, needsUsername: false, username: null,
      accountUrl: null, email: null, path: '/', discovered: session.unlocked.size,
      neverUnlocked: secrets.length - session.unlocked.size, unlocked: session.unlocked };
    return {
      count: session.unlocked.size,
      html: renderToStaticMarkup(<>{compose(secrets, session.unlocked, ctx).slot('home.center')}</>),
      css: secrets.filter(s => session.unlocked.has(s.manifest.n)).map(s => s.css ?? '').join('\n'),
    };
  };
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {

    const authority = `127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== authority) { res.sendStatus(403); return; }
    if (req.headers.origin && req.headers.origin !== `http://${authority}`) { res.sendStatus(403); return; }
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    next();
  });
  app.use(express.json({ limit: '4kb' }));
  app.get('/client.js', (_req, res) => res.type('js').send(client));
  app.get('/', (req, res) => {
    const session = sessionOf(req) ?? newSession(res);
    if (!session) return;
    const view = projection(session);
    res.type('html').send('<!doctype html>' + renderToStaticMarkup(
      <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Secrets engine example</title>
        <style>{'body{font:18px/1.5 system-ui;max-width:42rem;margin:8vh auto;padding:0 1.5rem;color:#222;background:#fff}input,button{font:inherit;padding:.5rem}form{display:flex;gap:.5rem;flex-wrap:wrap}label{width:100%}:focus-visible{outline:2px solid #2463eb;outline-offset:3px}#reset{margin-top:2rem}'}</style>
        <style id="earned-style" dangerouslySetInnerHTML={{ __html: view.css }} />
      </head><body><h1>Secrets engine example</h1>
        <p>This is a local demonstration with one synthetic discovery. Type <code>example</code> below and submit it.</p>
        <form id="input-form"><label htmlFor="input">Your input</label><input id="input" name="input" maxLength={128} autoComplete="off" required /><button>Try it</button></form>
        <p id="status" role="status">{view.count} of {secrets.length} discovered.</p>
        <div data-slot="home.center" dangerouslySetInnerHTML={{ __html: view.html }} />
        <button id="reset" type="button">Start over</button><script type="module" src="/client.js" />
      </body></html>,
    ));
  });
  app.post('/b', (req, res) => {
    const session = sessionOf(req);
    if (!session) { res.sendStatus(401); return; }
    const input: unknown = req.body?.input;
    if (typeof input !== 'string' || !input.length || input.length > 128) { res.sendStatus(400); return; }
    const now = Date.now();
    if (now - session.window >= 60_000) { session.window = now; session.requests = 0; }
    if (++session.requests > 60) { res.sendStatus(429); return; }
    const window = { events: [...input].map(k => ({ t: 'k' as const, k, ts: now })), ua: '',
      vw: 0, vh: 0, idle: 0, path: '/', scrolled: 0, below: 0, t0: now };
    for (const result of evaluate(secrets, window, session.unlocked, new Date(now), durable(), tagged).unlocked) {
      session.unlocked.add(result.n);
    }
    res.json(projection(session));
  });
  app.get('/i/:n', (req, res) => {
    const n = Number(req.params.n);
    const session = sessionOf(req);
    if (!/^\d+$/.test(req.params.n) || !session?.unlocked.has(n) || !byNumber.has(n) || !islands.has(n)) {
      res.sendStatus(404); return;
    }
    res.type('js').send(islands.get(n));
  });
  app.post('/reset', (req, res) => {
    if (!req.is('application/json')) { res.sendStatus(415); return; }
    const id = cookieId(req);
    if (!id || !sessionOf(req)) { res.sendStatus(401); return; }
    sessions.delete(id);
    if (newSession(res)) res.sendStatus(204);
  });
  app.use((_req, res) => res.sendStatus(404));
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.sendStatus(error.status === 413 ? 413 : 400);
  });
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 5178);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
  const app = await createDemo();
  const server = app.listen(port, '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address === 'object') console.log(`Demo: http://127.0.0.1:${address.port}`);
  });
}
