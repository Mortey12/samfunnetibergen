# Skiftlista leader app (prototype)

The page where bar leaders see wishes and place people on shifts, as a
separate frontend for Kvarteret Personal. Svelte 5 with Vite (no SvelteKit),
Tailwind 4 and the website's hs theme. This folder is a **prototype with
invented data only**: it talks to no server; `src/core/fake.ts` plays
Personal's part in memory and resets on reload.

## Run it

From the repository root:

    npm ci
    npm run dev:skiftlista

Open http://localhost:3190.

## Checks

    npm run typecheck:skiftlista          # svelte-check: types and Svelte's a11y warnings
    npm run test:skiftlista               # Vitest: the framework-free core
    npm --workspace @samfunnet/skiftlista run test:e2e   # Playwright: the whole page
    npm --workspace @samfunnet/skiftlista run build
    npx --no-install biome check apps/skiftlista

`typecheck:skiftlista` and `test:skiftlista` are part of the root `typecheck`
and `test` scripts, so CI runs them. The browser tests are not in CI yet.

The browser tests need Chromium once: `npx playwright install chromium`
(inside `apps/skiftlista`). On Linux it also needs a few system libraries:
`sudo npx playwright install-deps chromium`. Without sudo, unpack them
locally and point `LD_LIBRARY_PATH` at them:

    mkdir -p ~/.cache/ms-playwright/syslibs/debs && cd ~/.cache/ms-playwright/syslibs/debs
    apt-get download libnspr4 libnss3 libasound2t64
    for d in *.deb; do dpkg -x "$d" ../root; done
    export LD_LIBRARY_PATH=~/.cache/ms-playwright/syslibs/root/usr/lib/x86_64-linux-gnu

## Tooling notes

- **TypeScript 6 in this workspace only.** `svelte-check` 4.7 supports
  TypeScript 5 and 6, not 7, which the rest of the repository uses. npm keeps
  TypeScript 6 inside `apps/skiftlista/node_modules`. When `svelte-check`
  supports 7, drop the pin (or use `typescript@~6` plus
  `@typescript/native@npm:typescript@7` and `svelte-check --tsgo`).
- **Biome sees only the `<script>` part of `.svelte` files.** It formats and
  lints that part, but would report everything used only in the markup as
  unused, so `apps/skiftlista/biome.json` turns `noUnusedImports`,
  `noUnusedVariables` and `useConst` off for `.svelte` files. The markup is
  not formatted by any tool; `prettier-plugin-svelte` is the option if that
  becomes a problem. Svelte's own accessibility checks run in `svelte-check`.

## What to try

- Pick a person in "Folk denne uka": empty places that fit say "Sett inn
  <name>", with warnings as text. Click one to place.
- Click any place with nobody selected: the side panel lists Vil, Kan, Ikke
  svart and Kan ikke, fewest shifts first. On a filled place: "Fjern",
  "Flytt eller bytt" (then click a target place), or pick someone to swap in.
- Drag a person onto a place, or a placed person onto another place (move to
  empty, swap with filled). Dragging is a shortcut only; every drag has a
  click path.
- Click a day header to sort people by their answers for that day.
- The chips jump to the first problem, warning, open place or person without
  a shift.
- "Angre" or Ctrl+Z undoes up to 20 steps in the shown week. Escape steps back
  one level (move mode, place panel, selection, day).
- "Publiser uka", then change something: the status says "Endret etter
  publisering".

## Layout of the code

- `src/core/`: no Svelte imports. `types.ts` (the JSON contract the app needs
  from Personal), `fake.ts` (the in-memory stand-in), `ops.ts` (actions and
  their inverses for undo), `view.ts` (counting, sorting, wording), `drag.ts`
  (what a drop means), and their tests.
- `src/board/`: the Svelte components (`WeekGrid`, `PlaceBox`, `PeoplePanel`,
  `PlacePanel`, `Chip`); `src/App.svelte` holds the state.
- `src/lib/`: class recipes copied from `apps/web` (`button.ts`,
  `selection-control.ts`), `cn.ts`, and `SectionMark.svelte`.
- `src/styles.css`: the website's hs tokens and paper background, copied from
  `apps/web/src/app/globals.css`, plus the answer colours and a darker red for
  filled red buttons (the website's own red fails contrast with white text).
- `e2e/`: the Playwright tests. They use only roles, visible text and the
  `data-slot` attribute, so they do not depend on the framework.
