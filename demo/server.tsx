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
import type { Ev } from '../src/shared/events.ts';
import type { DemoView } from './protocol.ts';

export async function createDemo() {
  const secrets = await loadSecrets();
  const tagged = tagIndex(secrets);
  const byNumber = new Map(secrets.map(secret => [secret.manifest.n, secret]));
  for (const { module } of secrets) {
    const reward = module.grants?.money ?? 0;
    if (!Number.isSafeInteger(reward) || reward < 0 || reward > 1000 || module.grants?.item
      || module.uses || module.consumes || module.creatorsOnly) {
      throw new Error('This demo supports bounded token rewards, without inventory or creator accounts.');
    }
  }
  const islands = new Map(secrets.filter(s => s.module.hasIsland).map(s =>
    [s.manifest.n, readFileSync(resolve('dist/islands', `${s.manifest.n}.js`), 'utf8')]));
  const client = readFileSync(resolve('dist/demo/client.js'), 'utf8');
  type Session = { unlocked: Set<number>; durable: Durable; scope: string; sequence: number;
    lastInput: string; expires: number; requests: number; window: number };
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
    const session: Session = { unlocked: new Set(), sequence: 0, lastInput: '',
      scope: randomBytes(16).toString('hex'), expires: now + lifetime, requests: 0, window: now,
      durable: { visits: 1, username: null, theme: null, shapes: [], solved: [], money: 0,
        inventory: {}, tally: {}, tallyAt: {}, placed: {}, vaulted: {}, bought: {}, hidden: [], carried: null } };
    const id = randomBytes(32).toString('hex');
    sessions.set(id, session);
    res.cookie('demo', id, { httpOnly: true, sameSite: 'strict', path: '/', maxAge: lifetime });
    return session;
  };
  const projection = (session: Session): DemoView => {
    const ctx: SlotCtx = { durable: session.durable, boards: [], farm: [], mine: session.unlocked.size,
      total: secrets.length, signedIn: false, needsUsername: false, username: null,
      accountUrl: null, email: null, path: '/', discovered: session.unlocked.size,
      neverUnlocked: secrets.length - session.unlocked.size, unlocked: session.unlocked };
    const hint = secrets.flatMap(s => session.unlocked.has(s.manifest.n)
      ? (s.manifest.hintsUnlocked ?? []).filter(h => !session.unlocked.has(h.n)).map(h => h.text ?? '')
      : [s.manifest.rootHint ?? '']).find(Boolean) ?? '';
    return {
      count: session.unlocked.size, total: secrets.length, money: session.durable.money,
      sequence: session.sequence, hint, feedback: '', notices: [],
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
        <style>{'body{font:16px/1.55 system-ui;max-width:42rem;margin:6vh auto;padding:0 1.25rem;color:#35342f;background:#fff}h1{font-size:2rem;font-weight:600;letter-spacing:-.04em}input,button{box-sizing:border-box;font:inherit;min-height:44px;padding:.6rem .9rem;border:1px solid #d9d5ca;border-radius:8px;background:transparent;color:inherit}button{cursor:pointer}button:hover,button:focus-visible,input:focus-visible{outline:none;background:#e7e3d7;color:#24221d}button:disabled{opacity:.5;cursor:default}form{display:flex;gap:.5rem;flex-wrap:wrap}label{width:100%}input{min-width:0;flex:1}#status,#hint,#feedback{color:#746f61;font-size:.875rem}#hint:empty,#feedback:empty,#notices:empty{display:none}#notices{padding:1rem;background:#f5f4ef;border-radius:8px}#notices p{margin:0}#reset{margin-top:1rem}body[data-busy=true] [data-island]{cursor:progress}@media(max-width:420px){body{margin:2rem auto}h1{font-size:1.65rem}}'}</style>
        <style id="earned-style" dangerouslySetInnerHTML={{ __html: view.css }} />
      </head><body data-scope={session.scope} data-sequence={session.sequence}><h1>Secrets engine example</h1>
        <p>Two made-up discoveries show how this place builds itself. Type <code>example</code> to find the first, then see what it can do.</p>
        <form id="input-form"><label htmlFor="input">Try a word</label><input id="input" name="input" maxLength={128} autoComplete="off" required /><button>Try it</button></form>
        <p id="status">{view.count} of {view.total} discovered · {view.money} demo tokens</p>
        <p id="hint">{view.hint}</p>
        <p id="feedback" role="status" />
        <div id="notices" role="status" />
        <div data-slot="home.center" dangerouslySetInnerHTML={{ __html: view.html }} />
        <button id="reset" type="button">Start over</button><script type="module" src="/client.js" />
      </body></html>,
    ));
  });
  app.post('/b', (req, res) => {
    const session = sessionOf(req);
    if (!session) { res.sendStatus(401); return; }
    const now = Date.now();
    if (now - session.window >= 60_000) { session.window = now; session.requests = 0; }
    if (++session.requests > 60) { res.sendStatus(429); return; }
    const { input, report, sequence, scope } = req.body ?? {};
    if (scope !== session.scope) { res.sendStatus(409); return; }
    const isText = typeof input === 'string' && input.length > 0 && input.length <= 128 && report === undefined;
    const isReport = typeof report === 'string' && report.length > 0 && report.length <= 64 && input === undefined;
    if ((!isText && !isReport) || !Number.isSafeInteger(sequence) || sequence < 1 || sequence > 1e9) {
      res.sendStatus(400); return;
    }
    const signature = JSON.stringify([input ?? null, report ?? null]);
    if (sequence === session.sequence && signature === session.lastInput) {
      res.json(projection(session)); return;
    }
    if (sequence !== session.sequence + 1) { res.sendStatus(409); return; }
    if (isReport && (report !== 'example.turn' || !session.unlocked.has(999999))) {
      res.sendStatus(404); return;
    }
    const durable: Durable = { ...session.durable };
    if (isReport) {
      const turns = durable.tally['example.turns'] ?? 0;
      if (turns >= 1000) { res.sendStatus(409); return; }
      durable.tally = { ...durable.tally, 'example.turns': turns + 1 };
      durable.tallyAt = { ...durable.tallyAt, 'example.turns': now };
    }
    const events: Ev[] = isText ? [...input].map(k => ({ t: 'k', k, ts: now })) : [{ t: 'x', k: report, ts: now }];
    const window = { events, ua: '', vw: 0, vh: 0, idle: 0, path: '/', scrolled: 0, below: 0, t0: now };
    const outcome = evaluate(secrets, window, session.unlocked, new Date(now), durable, tagged);
    const unlocked = new Set(session.unlocked);
    const notices: DemoView['notices'] = [];
    for (const result of outcome.unlocked) {
      const module = byNumber.get(result.n)!.module;
      unlocked.add(result.n);
      durable.money += module.grants?.money ?? 0;
      notices.push({ name: module.name, explanation: module.unlockExplanation });
    }

    Object.assign(session, { durable, unlocked, sequence, lastInput: signature });
    const feedback = outcome.early.map(e => e.text ?? (e.kind === 'held' ? 'You have already found that one.' : 'Something is still missing.')).join(' ');
    res.json({ ...projection(session), feedback, notices });
  });
  app.get('/i/:n', (req, res) => {
    const n = Number(req.params.n);
    const session = sessionOf(req);
    if (!/^\d+$/.test(req.params.n) || !session?.unlocked.has(n) || !islands.has(n)) {
      res.sendStatus(404); return;
    }
    res.type('js').send(islands.get(n));
  });
  app.post('/reset', (req, res) => {
    if (!req.is('application/json')) { res.sendStatus(415); return; }
    const id = cookieId(req);
    const session = sessionOf(req);
    if (!id || !session) { res.sendStatus(401); return; }
    if (req.body?.scope !== session.scope) { res.sendStatus(409); return; }
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
