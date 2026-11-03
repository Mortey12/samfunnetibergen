<script lang="ts">
import { ChevronLeft, ChevronRight, Printer, Undo2 } from "@lucide/svelte"
import Chip from "./board/Chip.svelte"
import PeoplePanel from "./board/PeoplePanel.svelte"
import PlacePanel from "./board/PlacePanel.svelte"
import WeekGrid from "./board/WeekGrid.svelte"
import { addDays, FIRST_WEEK } from "./core/fake"
import {
  inverseOf,
  type Op,
  occupant,
  pushUndo,
  run,
  type UndoEntry,
  weekKeyOf,
} from "./core/ops"
import {
  type LeaderApi,
  type LeaderMe,
  type Note,
  type Place,
  RefusedError,
  type WeekBoard,
} from "./core/types"
import {
  type Filter,
  firstName,
  isOpen,
  longDate,
  type PlaceRef,
  personById,
  placeName,
  placeRef,
  STATUS_TEXT,
  summarize,
  weekLabel,
} from "./core/view"
import { buttonVariants } from "./lib/button"
import { cn } from "./lib/cn"
import SectionMark from "./lib/SectionMark.svelte"
import { selectionControlVariants } from "./lib/selection-control"
import { Sheet, SheetContent } from "./lib/sheet"

const UNPUBLISHED_HELP: Record<"open" | "changed_after_publish", string> = {
  open: "Folk ser ikke skiftene sine i appen før du trykker «Publiser uka».",
  changed_after_publish:
    "Trykk «Publiser uka» igjen når du er ferdig med endringene.",
}

interface Message {
  text: string
  warnings: Note[]
  error: boolean
}

let { api }: { api: LeaderApi } = $props()

let me = $state<LeaderMe | null>(null)
let barId = $state<number | null>(null)
let weekStart = $state(FIRST_WEEK)
let board = $state<WeekBoard | null>(null)
let busy = $state(false)
let selectedId = $state<number | null>(null)
let openSlot = $state<number | null>(null)
let moveFrom = $state<number | null>(null)
let focusDay = $state<string | null>(null)
let query = $state("")
let filter = $state<Filter>("alle")
let message = $state<Message | null>(null)
let undo = $state<UndoEntry[]>([])
let showMissing = $state(false)
// After an action, focus goes to the changed place (as on Personal's week
// page). It waits for the render that shows the new week.
let pendingFocus = $state<number | null>(null)
// From 80rem (Tailwind's xl) the place panel sits beside the grid; below it
// the panel opens in a sheet over the page. Same breakpoint as the grid's
// two-column layout in the markup below.
const wideQuery = window.matchMedia("(min-width: 80rem)")
let wide = $state(wideQuery.matches)

const selected = $derived(
  board && selectedId !== null ? (personById(board, selectedId) ?? null) : null,
)
const summary = $derived(board ? summarize(board) : null)
const currentUndo = $derived(
  board
    ? undo.filter(entry => entry.weekKey === weekKeyOf(board as WeekBoard))
    : [],
)
const openRef = $derived<PlaceRef | null>(
  board && openSlot !== null ? placeRef(board, openSlot) : null,
)
const lastWeek = $derived(board?.strip.at(-1)?.week_start ?? weekStart)
const statusTone = $derived(
  board?.status === "published"
    ? "bg-answer-vil text-answer-vil-ink"
    : board?.status === "changed_after_publish"
      ? "bg-answer-kan text-answer-kan-ink"
      : "bg-secondary-50 text-secondary-950",
)

$effect(() => {
  const update = () => (wide = wideQuery.matches)
  wideQuery.addEventListener("change", update)
  return () => wideQuery.removeEventListener("change", update)
})

$effect(() => {
  api.me().then(result => {
    me = result
    barId = result.bars[0]?.id ?? null
  })
})

$effect(() => {
  const id = barId
  const start = weekStart
  if (id === null) return
  let live = true
  api.week(id, start).then(result => {
    if (live) board = result
  })
  return () => {
    live = false
  }
})

$effect(() => {
  if (pendingFocus === null || busy || !board) return
  document.querySelector<HTMLElement>(`[data-slot="${pendingFocus}"]`)?.focus()
  pendingFocus = null
})

function labelFor(op: Op, current: WeekBoard): string {
  const name = (id: number | null) =>
    id === null ? "" : (personById(current, id)?.name ?? "")
  switch (op.type) {
    case "place":
      return `${name(op.volunteerId)} satt inn`
    case "remove":
      return `${name(occupant(current, op.slotId))} fjernet`
    case "replace":
      return `${name(op.volunteerId)} byttet inn`
    case "move":
      return `${name(occupant(current, op.fromSlotId))} flyttet`
    case "swap":
      return "bytte"
    case "status":
      return op.status === "published" ? "publisering" : "åpning"
  }
}

async function execute(op: Op, label: string, isUndo = false) {
  const current = board
  if (!current || busy) return
  busy = true
  try {
    const inverse = isUndo ? null : inverseOf(op, current)
    const result = await run(api, current, op)
    board = result.board
    message = { text: result.message, warnings: result.warnings, error: false }
    if (isUndo) undo = undo.slice(0, -1)
    else if (inverse)
      undo = pushUndo(undo, { weekKey: weekKeyOf(current), label, inverse })
    openSlot = null
    moveFrom = null
    pendingFocus =
      op.type === "place" || op.type === "remove" || op.type === "replace"
        ? op.slotId
        : op.type === "move"
          ? op.toSlotId
          : op.type === "swap"
            ? op.slotB
            : null
  } catch (error) {
    const text =
      error instanceof RefusedError
        ? error.message
        : "Noe gikk galt. Prøv igjen."
    message = { text, warnings: [], error: true }
    board = await api.week(current.bar.id, current.week_start)
  } finally {
    busy = false
  }
}

function doOp(op: Op) {
  if (board) execute(op, labelFor(op, board))
}

function undoLast() {
  const last = currentUndo.at(-1)
  if (last) execute(last.inverse, last.label, true)
}

function onPlaceClick(place: Place) {
  if (!board) return
  if (moveFrom !== null) {
    if (moveFrom === place.slot_id) {
      moveFrom = null
      return
    }
    doOp(
      isOpen(place)
        ? { type: "move", fromSlotId: moveFrom, toSlotId: place.slot_id }
        : { type: "swap", slotA: moveFrom, slotB: place.slot_id },
    )
    return
  }
  const fit = selected && board.fit[selected.volunteer_id]?.[place.slot_id]
  if (selected && isOpen(place) && fit?.ok) {
    doOp({
      type: "place",
      slotId: place.slot_id,
      volunteerId: selected.volunteer_id,
    })
    return
  }
  openSlot = openSlot === place.slot_id ? null : place.slot_id
}

function closePlace() {
  pendingFocus = openSlot
  openSlot = null
}

function startMove(slotId: number) {
  openSlot = null
  moveFrom = slotId
  pendingFocus = slotId
}

function changeWeek(start: string) {
  openSlot = null
  moveFrom = null
  focusDay = null
  weekStart = start
}

function pickBar(id: number) {
  openSlot = null
  moveFrom = null
  selectedId = null
  focusDay = null
  query = ""
  filter = "alle"
  barId = id
}

// Escape steps back one level; Ctrl/Cmd+Z undoes. No single-key shortcuts,
// so nothing fires while a screen reader user types (WCAG 2.1.4).
function onKeydown(event: KeyboardEvent) {
  const target = event.target instanceof Element ? event.target : null
  const typing = target?.closest("input, textarea")
  if ((event.ctrlKey || event.metaKey) && event.key === "z" && !typing) {
    event.preventDefault()
    undoLast()
    return
  }
  if (event.key !== "Escape") return
  // In the sheet, Bits UI closes it on Escape (and onOpenChange moves focus).
  if (!wide && openSlot !== null && moveFrom === null) return
  if (typing && (typing as HTMLInputElement).value) return
  if (moveFrom !== null) {
    pendingFocus = moveFrom
    moveFrom = null
  } else if (openSlot !== null) closePlace()
  else if (selectedId !== null) selectedId = null
  else if (focusDay !== null) focusDay = null
}

function problemTitle(refs: PlaceRef[]): string {
  return refs
    .map(
      ref =>
        `${placeName(ref)}: ${ref.place.assignment?.problems.map(note => note.text).join(", ")}`,
    )
    .join("\n")
}
</script>

<svelte:window onkeydown={onKeydown} />

{#if !me || !board || !summary}
  <p class="p-8" role="status">Laster skiftplanen …</p>
{:else}
  <div class="flex min-h-dvh flex-col">
    <a
      class="focus-brutal sr-only rounded-base bg-card p-2 focus:not-sr-only focus:absolute focus:z-10"
      href="#people-panel"
    >
      Gå til folk
    </a>
    <!-- Like the website's navbar: brand left, text links right, the active
         link underlined in the house red. -->
    <header class="noprint bg-background">
      <div
        class="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6"
      >
        <p class="flex items-center gap-2.5 text-primary">
          <SectionMark class="h-5" />
          <span
            class="text-2xl font-heading leading-none [font-family:var(--font-display)]"
          >
            Skiftlista
          </span>
          <span class="sr-only">, Samfunnet i Bergen</span>
        </p>
        <nav aria-label="Barer" class="flex flex-wrap items-center">
          {#each me.bars as bar (bar.id)}
            {@const active = bar.id === board.bar.id}
            <button
              type="button"
              aria-current={active ? "page" : undefined}
              class={cn(
                "focus-brutal relative cursor-pointer px-3 py-2.5 font-heading text-foreground hover:text-primary",
                active &&
                  "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary",
              )}
              onclick={() => pickBar(bar.id)}
            >
              {bar.name}
            </button>
          {/each}
        </nav>
        <p class="ml-auto text-sm text-foreground-muted">{me.name}</p>
      </div>
    </header>

    <div class="paper-surface flex-1">
      <div class="mx-auto flex max-w-[90rem] flex-col gap-4 px-4 py-5 sm:px-6">
        <!-- Title block in the website's page-title style. -->
        <section aria-label="Uke" class="flex flex-col gap-4">
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div class="flex flex-col gap-1.5">
              <p class="text-sm text-foreground-muted">
                Skiftplan for {board.bar.name}
              </p>
              <div class="flex flex-wrap items-center gap-3">
                <h1 class="text-4xl leading-none sm:text-5xl">
                  Uke {board.week_number}
                </h1>
                <span
                  class={cn("rounded-base px-2 py-0.5 text-sm font-heading", statusTone)}
                >
                  {STATUS_TEXT[board.status]}
                </span>
              </div>
              <p class="text-foreground-muted">
                {weekLabel(board).replace(/^Uke \d+ \((.*)\)$/, "$1")}
                · Har svart
                <strong class="text-foreground">{summary.answered}</strong>
                av {board.people.length} ·
                <button
                  type="button"
                  aria-controls="missing-list"
                  aria-expanded={showMissing ? "true" : "false"}
                  class="focus-brutal cursor-pointer underline decoration-1 underline-offset-4 hover:text-primary"
                  onclick={() => (showMissing = !showMissing)}
                >
                  {showMissing ? "Skjul hvem" : "Vis hvem"}
                </button>
                {#if board.deadline}
                  · Svarfrist {longDate(board.deadline)}
                {/if}
              </p>
              {#if showMissing}
                <p class="text-sm" id="missing-list">
                  Ikke svart denne uka:
                  {summary.notAnswered.map(person => person.name).join(", ") ||
                    "ingen"}
                </p>
              {/if}
            </div>
            <nav aria-label="Uker" class="noprint flex items-center gap-2">
              <button
                type="button"
                aria-label="Forrige uke"
                class={selectionControlVariants({ size: "square" })}
                disabled={board.week_start <= FIRST_WEEK}
                onclick={() => board && changeWeek(addDays(board.week_start, -7))}
              >
                <ChevronLeft aria-hidden="true" class="size-4" />
              </button>
              {#each board.strip as item (item.week_start)}
                {@const current = item.week_start === board.week_start}
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  aria-label={`Uke ${item.number}, ${STATUS_TEXT[item.status]}`}
                  class={cn(
                    selectionControlVariants({ selected: current }),
                    "rounded-full px-4",
                  )}
                  onclick={() => changeWeek(item.week_start)}
                >
                  {item.number}{item.status === "published" ? " ✓" : ""}
                </button>
              {/each}
              <button
                type="button"
                aria-label="Neste uke"
                class={selectionControlVariants({ size: "square" })}
                disabled={board.week_start >= lastWeek}
                onclick={() => board && changeWeek(addDays(board.week_start, 7))}
              >
                <ChevronRight aria-hidden="true" class="size-4" />
              </button>
            </nav>
          </div>

          {#if board.status !== "published"}
            <section
              aria-label="Publisering"
              class={cn(
                "noprint rounded-base border-2 border-dashed p-3 text-sm",
                board.status === "open"
                  ? "border-secondary bg-secondary-50 text-secondary-950"
                  : "border-answer-kan-ink bg-answer-kan text-answer-kan-ink",
              )}
            >
              <strong class="font-heading">
                {board.status === "open"
                  ? "Uka er ikke publisert."
                  : "Uka er endret etter publisering."}
              </strong>
              {UNPUBLISHED_HELP[board.status]}
            </section>
          {/if}

          <div class="noprint flex flex-wrap items-center gap-2">
            {#if summary.problems.length}
              <Chip
                tone="red"
                title={problemTitle(summary.problems)}
                onclick={() => {
                  if (summary) openSlot = summary.problems[0].place.slot_id
                }}
              >
                ! {summary.problems.length}
                {summary.problems.length === 1 ? "problem" : "problemer"}
              </Chip>
            {/if}
            {#if summary.warnings.length}
              <Chip
                tone="yellow"
                title={problemTitle(summary.warnings)}
                onclick={() => {
                  if (summary) openSlot = summary.warnings[0].place.slot_id
                }}
              >
                {summary.warnings.length}
                {summary.warnings.length === 1 ? "advarsel" : "advarsler"}
              </Chip>
            {/if}
            {#if summary.open.length}
              <Chip
                title={summary.open.map(placeName).join("\n")}
                onclick={() => {
                  if (summary) openSlot = summary.open[0].place.slot_id
                }}
              >
                {summary.open.length} ledige
              </Chip>
            {/if}
            {#if summary.withoutShift.length}
              <Chip
                title={`Har svart, men har ikke skift: ${summary.withoutShift.map(person => person.name).join(", ")}`}
                onclick={() => {
                  if (!summary) return
                  filter = "alle"
                  query = ""
                  selectedId = summary.withoutShift[0].volunteer_id
                }}
              >
                {summary.withoutShift.length} uten skift
              </Chip>
            {/if}
            <span class="grow"></span>
            <button
              type="button"
              class={cn(selectionControlVariants(), "gap-2 font-base")}
              disabled={busy || !currentUndo.length}
              title="Ctrl+Z"
              onclick={undoLast}
            >
              <Undo2 aria-hidden="true" class="size-4" />
              Angre{currentUndo.length ? ` ${currentUndo.at(-1)?.label}` : ""}
            </button>
            <button
              type="button"
              class={cn(selectionControlVariants(), "gap-2 font-base")}
              onclick={() => window.print()}
            >
              <Printer aria-hidden="true" class="size-4" />
              Skriv ut
            </button>
            <button
              type="button"
              class={cn(selectionControlVariants(), "font-base")}
              disabled
              title="Kommer i L3"
            >
              Lag forslag for uka
            </button>
            {#if board.status !== "published"}
              <button
                type="button"
                class={cn(buttonVariants(), "bg-cta")}
                disabled={busy}
                onclick={() => doOp({ type: "status", status: "published" })}
              >
                Publiser uka
              </button>
            {:else}
              <button
                type="button"
                class={buttonVariants({ variant: "neutral" })}
                disabled={busy}
                onclick={() => doOp({ type: "status", status: "open" })}
              >
                Gjør til utkast
              </button>
            {/if}
          </div>
          <div aria-live="polite" class="noprint min-h-8 text-sm" role="status">
            {#if message}
              <p
                class={cn(
                  "flex flex-wrap items-center gap-2 rounded-base px-3 py-1.5",
                  message.error
                    ? "bg-answer-nei text-answer-nei-ink"
                    : "bg-answer-vil text-answer-vil-ink",
                )}
              >
                <span>
                  {message.text}{message.warnings.length
                    ? ` Advarsel: ${message.warnings.map(note => note.text).join(", ")}.`
                    : ""}
                </span>
                <button
                  type="button"
                  class="focus-brutal ml-auto cursor-pointer underline underline-offset-4"
                  onclick={() => (message = null)}
                >
                  Lukk melding
                </button>
              </p>
            {/if}
          </div>
          {#if moveFrom !== null}
            <p
              class="noprint rounded-base border-2 border-dashed border-secondary bg-secondary-50 p-2 text-sm"
            >
              Velg en ledig plass å flytte til, eller en person å bytte med.
              Escape avbryter.
            </p>
          {/if}
        </section>

        <main
          class="board-main grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]"
        >
          <WeekGrid
            {board}
            {busy}
            {focusDay}
            {moveFrom}
            {openSlot}
            {selected}
            onFocusDay={day => {
              focusDay = day
              selectedId = null
            }}
            onOp={doOp}
            {onPlaceClick}
          />
          <aside
            class="noprint flex max-h-[36rem] min-h-0 flex-col xl:max-h-[calc(100dvh-14rem)]"
          >
            {#if openRef && wide}
              <PlacePanel
                {board}
                {busy}
                placeRef={openRef}
                onClose={closePlace}
                onOp={doOp}
                onStartMove={startMove}
              />
            {:else}
              <PeoplePanel
                {board}
                {filter}
                {focusDay}
                {selected}
                bind:query
                onClearDay={() => (focusDay = null)}
                onFilter={value => (filter = value)}
                onSelect={person => {
                  selectedId = person?.volunteer_id ?? null
                  focusDay = null
                }}
              />
            {/if}
          </aside>
        </main>
        {#if !wide}
          <!-- Narrow screens: the place opens in a sheet over the page. -->
          <Sheet
            open={openRef !== null}
            onOpenChange={open => {
              if (!open) closePlace()
            }}
          >
            {#if openRef}
              <SheetContent
                labelledby="place-heading"
                onOpenAutoFocus={event => event.preventDefault()}
                onCloseAutoFocus={event => event.preventDefault()}
              >
                <PlacePanel
                  {board}
                  {busy}
                  framed={false}
                  placeRef={openRef}
                  onClose={closePlace}
                  onOp={doOp}
                  onStartMove={startMove}
                />
              </SheetContent>
            {/if}
          </Sheet>
        {/if}
        <footer class="noprint text-xs text-foreground-muted">
          Prototype med oppdiktede data. Ingenting lagres. Tastatur: Tab mellom
          plasser, Enter velger, Escape går ett steg tilbake, Ctrl+Z angrer.
          {selected ? `Valgt: ${firstName(selected.name)}.` : ""}
        </footer>
      </div>
    </div>
  </div>
{/if}
