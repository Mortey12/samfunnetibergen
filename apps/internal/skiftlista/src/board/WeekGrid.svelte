<!-- The week grid: days as columns, positions in the bar's day as rows. -->
<script lang="ts">
import type { Op } from "../core/ops"
import type { Person, Place, WeekBoard } from "../core/types"
import {
  ANSWER_WORD,
  addableKinds,
  answerOf,
  DAY_NAMES,
  firstName,
  longDate,
  shiftAt,
  weekDays,
  wishNames,
} from "../core/view"
import { cn } from "../lib/cn"
import PlaceBox from "./PlaceBox.svelte"
import RolePlaces from "./RolePlaces.svelte"

interface Props {
  board: WeekBoard
  selected: Person | null
  openSlot: number | null
  moveFrom: number | null
  focusDay: string | null
  busy: boolean
  onFocusDay: (day: string | null) => void
  onPlaceClick: (place: Place) => void
  onOp: (op: Op) => void
}

let props: Props = $props()

const days = $derived(weekDays(props.board))
const kinds = $derived(addableKinds(props.board))
const activeDays = $derived(new Set(props.board.shifts.map(shift => shift.day)))

// On a phone the grid shows ONE day at a time (the strip above the table picks
// it); from the `md` breakpoint up all days show, and paper always shows all.
// The other days are hidden with CSS (`display: none`), so they also leave the
// tab order and the accessibility tree.
let picked = $state<string | null>(null)
const phoneDay = $derived(
  picked && activeDays.has(picked)
    ? picked
    : (days.find(day => activeDays.has(day)) ?? null),
)
/** Classes for a column of `day`: hidden on a phone unless it is the chosen day. */
const phoneColumn = (day: string) =>
  day === phoneDay ? undefined : "max-md:hidden print:table-cell"

/** "Satt opp" or "Opptatt" in a day header for the selected person. */
function busyMark(day: string): string | null {
  const selected = props.selected
  if (!selected?.busy_days.includes(day)) return null
  const here = props.board.shifts.some(
    shift =>
      shift.day === day &&
      shift.places.some(
        place => place.assignment?.volunteer_id === selected.volunteer_id,
      ),
  )
  return here ? "· Satt opp" : "· Opptatt"
}

// Four names fit in a day column; the rest are "+n".
function nameList(names: string[]): string {
  return names.length <= 4
    ? names.join(", ")
    : `${names.slice(0, 4).join(", ")} +${names.length - 4}`
}

function counts(answers: Record<string, string>) {
  let vil = 0
  let kan = 0
  for (const answer of Object.values(answers)) {
    if (answer === "vil") vil++
    if (answer === "kan") kan++
  }
  return { vil, kan }
}
</script>

<nav
  aria-label="Velg dag"
  class="noprint mb-2 flex gap-1 overflow-x-auto md:hidden"
>
  {#each days as day, index (day)}
    {#if activeDays.has(day)}
      <button
        type="button"
        aria-pressed={day === phoneDay ? "true" : "false"}
        class={cn(
          "focus-brutal shrink-0 cursor-pointer rounded-base border border-border px-3 py-1.5 text-left text-sm",
          day === phoneDay
            ? "bg-secondary font-heading text-secondary-foreground"
            : "bg-background",
        )}
        onclick={() => (picked = day)}
      >
        <span class="block font-heading">{DAY_NAMES[index]}</span>
        <span class="block text-xs opacity-80">{longDate(day)}</span>
      </button>
    {/if}
  {/each}
</nav>

<!-- The grid scrolls sideways on narrow screens; keyboard users need a
     focusable region to scroll it. `relative` keeps the screen-reader-only
     text inside the scroll box, so the page itself never scrolls sideways. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
  aria-label={`Ukeplan, ${props.board.bar.name}`}
  class="week-grid relative min-w-0 overflow-x-auto rounded-base border border-border bg-card shadow-shadow"
  tabindex="0"
>
  <table class="w-full table-fixed border-collapse text-sm md:min-w-[46rem]">
    <caption class="sr-only">
      Skift for {props.board.bar.name}, uke {props.board.week_number}. Kolonner er
      dager, rader er skift. Trykk på en dag for å se hvem som vil og kan.
    </caption>
    <colgroup>
      <col class="w-24 md:w-28" />
      {#each days as day (day)}
        <col
          class={cn(
            activeDays.has(day) ? undefined : "w-10",
            phoneColumn(day),
          )}
        />
      {/each}
    </colgroup>
    <thead>
      <tr>
        <td class="border-b border-border"></td>
        {#each days as day, index (day)}
          {@const pressed = props.focusDay === day}
          <th
            scope="col"
            class={cn(
              "border-b border-l border-border p-0 text-left align-bottom font-base",
              phoneColumn(day),
            )}
          >
            {#if activeDays.has(day)}
              <button
                type="button"
                aria-pressed={pressed ? "true" : "false"}
                class={cn(
                  "focus-brutal block w-full cursor-pointer px-2 py-2 text-left hover:bg-muted",
                  pressed &&
                    "bg-secondary text-secondary-foreground hover:bg-secondary",
                )}
                onclick={() => props.onFocusDay(pressed ? null : day)}
              >
                <!-- Visible text first, so the accessible name starts with
                     what is on screen (WCAG 2.5.3). -->
                <span class="block font-heading">{DAY_NAMES[index]}</span>
                <span class="block text-xs opacity-80">
                  {longDate(day)}
                  {#if busyMark(day)}
                    <span class="ml-1 font-heading">{busyMark(day)}</span>
                  {/if}
                </span>
                <span class="sr-only">Vis hvem som vil og kan.</span>
              </button>
            {:else}
              <span
                class="block px-1 py-2 text-center text-xs text-foreground-muted"
              >
                <span aria-hidden="true">{DAY_NAMES[index].slice(0, 2)}</span>
                <span class="sr-only">
                  {DAY_NAMES[index]}
                  {longDate(day)}: ingen skift
                </span>
              </span>
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each props.board.rows as row (row.position)}
        <tr>
          <th
            scope="row"
            class="sticky left-0 z-10 border-t border-border bg-card p-2 text-left align-top font-base"
          >
            <span class="block font-heading">{row.label}</span>
            <span class="block text-xs text-foreground-muted">
              {row.time_label}
            </span>
          </th>
          {#each days as day (day)}
            {@const shift = shiftAt(props.board, day, row.position)}
            <td
              class={cn(
                "border-t border-l border-border p-1.5 align-top",
                phoneColumn(day),
                !shift && "bg-muted/40",
                props.focusDay === day && "bg-secondary-50/70",
              )}
            >
              {#if shift}
                {@const total = counts(shift.answers)}
                {@const wishes = wishNames(props.board, shift)}
                {@const selectedAnswer = props.selected
                  ? (answerOf(shift, props.selected.volunteer_id) ?? "none")
                  : null}
                <div class="flex flex-col gap-1">
                  {#each shift.places as place (place.slot_id)}
                    <PlaceBox
                      board={props.board}
                      {shift}
                      {place}
                      selected={props.selected}
                      openSlot={props.openSlot}
                      moveFrom={props.moveFrom}
                      busy={props.busy}
                      onPlaceClick={props.onPlaceClick}
                      onOp={props.onOp}
                    />
                  {/each}
                  {#if !shift.closed}
                    {#each kinds as kind (kind)}
                      <RolePlaces
                        {kind}
                        {shift}
                        busy={props.busy}
                        onOp={props.onOp}
                      />
                    {/each}
                  {/if}
                  <p
                    class="noprint flex flex-wrap justify-between gap-x-2 text-xs text-foreground-muted"
                  >
                    <span>{total.vil} vil · {total.kan} kan</span>
                    {#if props.selected && selectedAnswer}
                      <span class="font-heading text-foreground">
                        {firstName(props.selected.name)}: {ANSWER_WORD[
                          selectedAnswer
                        ]}
                      </span>
                    {/if}
                  </p>
                  {#if wishes.vil.length || wishes.kan.length}
                    <p
                      data-wishes={shift.shift_id}
                      class="text-[0.7rem] leading-snug text-foreground-muted"
                    >
                      {#if wishes.vil.length}
                        <span class="block">
                          <span class="font-heading">Vil:</span>
                          {nameList(wishes.vil)}
                        </span>
                      {/if}
                      {#if wishes.kan.length}
                        <span class="block">
                          <span class="font-heading">Kan:</span>
                          {nameList(wishes.kan)}
                        </span>
                      {/if}
                    </p>
                  {/if}
                </div>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</section>
