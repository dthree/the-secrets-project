import type { DemoInput, DemoRequest, DemoView } from './protocol.ts';

const form = document.querySelector<HTMLFormElement>('#input-form')!;
const input = document.querySelector<HTMLInputElement>('#input')!;
const status = document.querySelector<HTMLElement>('#status')!;
const feedback = document.querySelector<HTMLElement>('#feedback')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
const content = document.querySelector<HTMLElement>('[data-slot="home.center"]')!;
const scope = document.body.dataset.scope!;
let sequence = Number(document.body.dataset.sequence);
let generation = 0;
let busy = false;
let pending: DemoRequest | null = null;

async function mount() {
  const current = generation;
  for (const root of content.querySelectorAll<HTMLElement>('[data-island]')) {
    if (root.dataset.mounted) continue;
    const id = root.dataset.island;
    if (!id || !/^\d+$/.test(id)) continue;
    const module = await import(/* @vite-ignore */ `/i/${id}`);
    if (current === generation && root.isConnected) {
      module.default(root);
      root.dataset.mounted = 'true';
    }
  }
}
function apply(view: DemoView) {
  sequence = view.sequence;
  const focus = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
  document.querySelector('#earned-style')!.textContent = view.css;
  content.innerHTML = view.html;
  if (focus) document.getElementById(focus)?.focus({ preventScroll: true });
  status.textContent = `${view.count} of ${view.total} discovered · ${view.money} demo tokens`;
  document.querySelector('#hint')!.textContent = view.hint;
  feedback.textContent = view.feedback;
  const notices = document.querySelector('#notices')!;
  notices.replaceChildren();
  for (const notice of view.notices) {
    const p = document.createElement('p');
    const name = document.createElement('strong');
    name.textContent = notice.name;
    p.append(name, ` — ${notice.explanation}`);
    notices.append(p);
  }
}
async function submit(payload: DemoInput, retry = false) {
  if (busy || reset.disabled || (pending && !retry)) return;
  busy = true;
  document.body.dataset.busy = 'true';
  const current = generation;

  pending ??= { ...payload, sequence: sequence + 1, scope };
  try {
    const response = await fetch('/b', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
    if (!response.ok) {
      if (response.status !== 429) pending = null;
      throw new Error(response.status === 409 ? 'This page is out of date. Reload to continue.'
        : response.status === 429 ? 'Please wait a minute, then retry.' : 'That action could not be checked. Reload to continue.');
    }
    const view: DemoView = await response.json();
    if (current !== generation) return;
    pending = null;
    apply(view);
    if ('input' in payload) input.value = '';
    await mount();
  } catch (error) {
    if (current === generation) {
      feedback.textContent = error instanceof Error ? error.message : 'The request failed.';
      if (pending) {
        const retry = document.createElement('button');
        retry.type = 'button'; retry.textContent = 'Retry';
        retry.addEventListener('click', () => { void submit(payload, true); });
        feedback.append(' ', retry);
      }
    }
  } finally {
    busy = false;
    delete document.body.dataset.busy;
  }
}
form.addEventListener('submit', event => {
  event.preventDefault();
  void submit({ input: input.value });
});
addEventListener('secrets:report', event => {
  const k: unknown = (event as CustomEvent).detail?.k;
  if (typeof k === 'string' && k.length <= 64) void submit({ report: k });
});
reset.addEventListener('click', async () => {
  if (reset.disabled) return;
  reset.disabled = true;
  generation++;
  pending = null;
  try {
    const response = await fetch('/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope }) });
    if (!response.ok) throw new Error('Reset failed. Reload and try again.');
    location.reload();
  } catch (error) {
    feedback.textContent = error instanceof Error ? error.message : 'Reset failed.';
    reset.disabled = false;
  }
});
void mount().catch(() => { feedback.textContent = 'The island could not load. Reload to retry.'; });
