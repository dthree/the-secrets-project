# Example secret

These two synthetic secrets demonstrate the current authoring format without including any of the site's discoveries. Run the demo from the [repository README](../../../README.md), then type `example` and turn the revealed machine's handle three times. Try `demo` first for near-miss feedback, and refresh after a turn to see the saved counter.

| Working feature | Where to read it |
| --- | --- |
| Public teaser, root hint and an outward hint edge | [manifest.ts](manifest.ts) |
| Typed detection, near-miss copy and declaration of a nested slot | [secret.tsx](secret.tsx) |
| A real button, reduced-motion-aware animation and a neutral interaction report | [island.tsx](island.tsx) |
| Responsive machine styling, delivered only after discovery | [style.css](style.css) |
| A second input channel and separate teaser | [sunrise manifest](../999998-sunrise/manifest.ts) |
| A prerequisite, a server-owned threshold, a reward and a contribution inside another secret | [sunrise definition](../999998-sunrise/secret.tsx) |
| An earned scene and reduced-motion-aware sunrise | [sunrise stylesheet](../999998-sunrise/style.css) |
| Saved state, ordered idempotent commands, reward commitment and complete reset | [demo server](../../../demo/server.tsx) |

The exported [schema](../../shared/secret.ts) remains the field reference. These are working examples of its mechanisms, with a small in-memory adapter replacing production storage.

## Files and registration

```text
src/secrets/999999-example/
  manifest.ts   Public metadata, exported as manifest
  secret.tsx    Server-owned definition, exported as secret
  island.tsx    Optional browser mount, exported as default
  style.css     Optional stylesheet delivered with the earned markup
```

The [registry](../../server/engine/registry.ts) discovers these folders at startup. A definition can be `secret.ts` when it contains no JSX; if both files exist, `secret.tsx` wins. The manifest's `n` is the identity used by prerequisites and delivery, and must be unique. The folder prefix is an organizing convention, so keep it aligned with `n`. Both large example numbers belong only to this demo.

The registry detects `island.tsx` and fills `hasIsland` automatically. The island builder emits `dist/islands/999999.js`, and the demo admits `/i/999999` only for the session that earned it. Do not serve the build directory as public static files. The rendered `data-island="999999"` host lets the demo client mount the default export. The sunrise has no island because its earned markup and CSS supply its whole presentation. A contribution to `home.center` uses an existing shell slot; declare additional slots through `declaresSlots` only when their host actually renders them.

The production system also supports optional server route handlers and appearance bootstraps. Their production routing, identity and storage integration is redacted from this repository; adding a route declaration here does not install a handler in the demo.

## Public metadata

`manifest.ts` exports a `PublicManifest`. Keep triggers, prerequisite lists, protected names and page destinations in the private definition.

| Field | Meaning |
| --- | --- |
| `n` | Required unique integer identity. |
| `teaser` | Required nonempty public label, authored in Title Case. Use the exact canonical name when no separate teaser is intended. Missing, null, empty and whitespace-only values are rejected. |
| `channels` | Required input channels consumed by the detector, drawn from `Channel` in [events.ts](../../shared/events.ts). The machine consumes `key`; the sunrise consumes `report`. |
| `medal` | Required authored rarity: `bronze`, `silver`, `gold` or `platinum`. |
| `rootHint` / `rootFigure` | Optional public entrance hint; choose at most one. A figure includes SVG and a click code. |
| `hintsUnlocked` | Optional outward hints made available by earning this secret. Each names another existing secret number and exactly one of `text` or `figure`. |

“Public” describes the disclosure class, not permission to import this file into a browser bundle. The server chooses which fields a response needs, and the browser build rejects imports of secret manifests and definitions.

## Server-owned definition

`secret.tsx` exports a `SecretModule`. Its required fields are `name`, `description`, `unlockExplanation` and `detect`. The canonical name uses Title Case; the description and earned explanation use ordinary prose. `unlockExplanation` tells the visitor what they did and must be nonempty. An optional `unlockExplanationTouch` supplies an accurate alternative for touch devices.

This example also supplies `unlockedBy`, a private technical description of the trigger; `discoveryPages: ['*']`, meaning page-independent discovery; and `tags: ['example']`, which lets `tagIndex` group it for collection detectors. `discoveryPages` documents where discovery can happen, while the detector and server admission decide where input is accepted. The demo accepts input on its homepage.

The detector reads `DetectCtx.window` and returns `MISS` or `unlockWord(WORD)`. `typedText` lowercases the key events, and `unlockWord` includes the matched length for typing feedback. Other detectors can return `UNLOCK` or a warmth verdict. Keep detectors synchronous and pure, with no database writes, network requests or reward side effects.

`DetectCtx` also provides server-loaded ownership (`unlocked`), time (`now`), a durable snapshot (`durable`) and the boot-time tag index (`tagged`). Its optional `justUnlocked` identifies discoveries committed earlier in the same batch; existing ownership is not a new discovery event. These facts must come from the server, even if a modified client submits similarly named fields.

The exported `SecretModule` type contains the full field shapes. These optional groups explain where configuration belongs:

| Configuration | Fields and responsibility |
| --- | --- |
| Eligibility | `requires` lists existing prerequisite numbers; the registry rejects missing references and cycles. `recurs` declares repeating weekday, monthly-date or annual-date conditions for the evaluator. |
| Near misses | `warmth` configures prerequisite, proximity and calendar feedback, including optional page scope. Its candidate words remain server-owned. |
| Composition | `contributions` supplies render entries or structural transforms; `declaresSlots` declares hosts. Render entries receive `SlotCtx` and a slot renderer. `label` is an optional earned display label. |
| Discovery details | `unlocks` describes immediate earned benefits with a title, description and icon. `unlockedBy`, `discoveryPages` and `progression` are private authoring metadata, never public clues or eligibility gates. |
| Revealed affordances | `reveal` can supply small render contributions before discovery; its detector returns an event timestamp for reset fencing. It grants no discovery, island access or reward. |
| Pages and navigation | `pages`, `navigateTo`, `arrivalUnlocks`, `pasteable`, `chromeEdge` and `gameMode` describe destinations and their presentation. Page metadata alone grants no access. |
| Public visitors | `publicVisitorMode`, `publicVisitorPaths` and `publicVisitorRoutes` declare admission and narrow read/play capabilities. Every game requires complete `play` admission; `publicExcept` is limited to non-game prize pages. Production admission and invitation handling are outside this demo. |
| Release visibility | `developmentOnly` excludes a definition unless `NODE_ENV=development`. `creatorsOnly` requires production creator-aware admission and public-list filtering, which the demo does not implement. It is independent of a game's public-play configuration. |
| Inventory and rewards | `uses` requires reusable equipment, `consumes` spends an item and `grants` declares an authored reward. The demo implements bounded `grants.money` as fictional demo tokens; it rejects inventory configuration at startup. Production uses its atomic storage/reward adapter. |
| Attribution and sharing | `credits` carries earned cultural acknowledgments or licensed-resource notices; `share` describes an approved share artifact. Their disclosure and rendering adapters remain private. |
| Interaction feedback | `interactionFeedback` declares advisory feedback for an admitted interaction, with no reward authority. Its production delivery adapter is omitted here. |

The demo exercises detection, near misses, text hints, ownership, nested composition, stylesheet delivery, island admission, a server-owned counter and one-time `grants.money` rewards. It does not supply the production page, inventory, sharing or account systems. Leave optional fields out when the example does not use them; declaring an unsupported field does not implement its behavior.

## Definitions, discoveries and saved progress

Definitions live in source files, while a visitor's discoveries and other progress live in server-owned storage. A manifest is not a save file, and an island cannot grant itself ownership by writing browser state.

The [demo server](../../../demo/server.tsx) keeps an expiring session with a `Set<number>` of discoveries and a `Durable` snapshot in memory. The machine reports every handle activation through `secrets:report`; the adapter checks ownership and increments `durable.tally`, while the second secret alone supplies the winning threshold and reward. Its HttpOnly cookie identifies the session, while the server evaluates input and records the result. Refresh retains progress until the session expires; restarting the process loses it. The store admits at most 1,000 sessions, expires them after 30 minutes and limits each session to 60 input submissions per minute. Word inputs are capped at 128 characters, reports at 64 characters, the turn counter at 1,000 and request bodies at 4 KiB. This is a bounded loopback demonstration, not a production persistence or capacity model.

The production persistence adapter is intentionally absent. It supplies owner-scoped discovery records and durable snapshots to the same engine. New durable profile progress belongs in its reset registry; other owner-scoped database rows and Redis state register with `storage.onReset`. Browser saves use the shared storage reset and write fence. Production writes must validate ownership and eligibility, use server-authored amounts, commit coupled rewards atomically, deduplicate retries and reject work from before the owner's reset. These mechanisms must be integrated before a new persistent feature is complete.

Each command carries a session scope and consecutive sequence. The server retains only the last command signature: an identical retry returns current state, while an older, conflicting or out-of-order command is refused. Discovery, counter and token balance commit together without yielding in this single process; concurrent retries cannot double the reward. A real multi-process store needs a transaction and owner lock.

In the demo, **Start over** deletes the old session, including its counter and reward balance, and issues a new identifier and scope. Old requests can no longer restore its discovery, island access disappears, and another visitor's progress is unaffected. The client also ignores responses from an earlier reset generation, and the server rejects old scopes even when a stale tab sends the replacement cookie. Submitted input can be fabricated, so accepting words or handle reports is a discovery rule, not proof of human play.

## Verify a change

Run `npm run build` and `npm test` from the repository root after editing. Typechecking checks the example against the exported schema, and the HTTP checks exercise both discovery paths, prerequisite refusal, near misses, hints, nested content, forged state, locked delivery, concurrent retries, one-time rewards, visitor isolation, reset, stale commands, request limits and bundle separation. Restart the demo after source edits because the registry caches definitions at startup.

When extending the demo, add checks for the behavior you introduce and keep later discoveries' names, answers and payloads out of earlier delivery. Changes to the real site's definitions and storage must use its private authoring and release workflow; this example is outside the live discovery corpus.
