export {};
const form = document.querySelector<HTMLFormElement>('#input-form')!;
const input = document.querySelector<HTMLInputElement>('#input')!;
const status = document.querySelector<HTMLElement>('#status')!;
const reset = document.querySelector<HTMLButtonElement>('#reset')!;
let generation = 0;
let busy = false;

async function mount() {
  const current = generation;
  for (const root of document.querySelectorAll<HTMLElement>('[data-island]')) {
    const id = root.dataset.island;
    if (!id || !/^\d+$/.test(id)) continue;
    const module = await import(/* @vite-ignore */ `/i/${id}`);
    if (current === generation && root.isConnected) module.default(root);
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  const current = generation;
  try {
    const response = await fetch('/b', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: input.value }) });
    if (!response.ok) throw new Error('Input could not be checked. Reload or try again.');
    const view = await response.json();
    if (current !== generation) return;
    document.querySelector('[data-slot="home.center"]')!.innerHTML = view.html;
    document.querySelector('#earned-style')!.textContent = view.css;
    status.textContent = `${view.count} discovered.`;
    input.value = '';
    await mount();
  } catch (error) {
    if (current === generation) status.textContent = error instanceof Error ? error.message : 'Please try again.';
  } finally { busy = false; }
});
reset.addEventListener('click', async () => {
  if (reset.disabled) return;
  reset.disabled = true;
  generation++;
  try {
    const response = await fetch('/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) throw new Error('Reset failed. Reload and try again.');
    location.reload();
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : 'Reset failed.';
    reset.disabled = false;
  }
});
void mount().catch(() => { status.textContent = 'The island could not load. Reload to retry.'; });
