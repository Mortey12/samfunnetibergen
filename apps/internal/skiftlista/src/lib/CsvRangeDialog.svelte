<!-- "Last ned flere uker": the leader picks how many weeks from the one on
     screen, and the app reads them one by one and saves one CSV file. Nothing
     is sent anywhere; weeks that are not published are included, and the
     "Ukestatus" column says so. A week that cannot be read stops the download
     and says which one, so nobody gets a file with a hole in it. -->
<script lang="ts">
import { Dialog } from "bits-ui"
import { buttonVariants } from "./button"
import { cn } from "./cn"

interface Props {
  open: boolean
  /** Number of the week on screen, for the wording. */
  fromWeek: number
  /** "uke 49 til 50" for the first n weeks from the one on screen. */
  rangeText: (weeks: number) => string
  /** How many weeks can be asked for at most. */
  maxWeeks: number
  /** Reads and saves the weeks; rejects with a reason in Norwegian. */
  download: (weeks: number) => Promise<void>
  onClose: () => void
}

let { open, fromWeek, rangeText, maxWeeks, download, onClose }: Props = $props()

const CHOICES = [2, 3, 4, 6, 8, 12]
const choices = $derived(CHOICES.filter(n => n <= maxWeeks))
let weeks = $state(4)
let working = $state(false)
let failure = $state<string | null>(null)

$effect(() => {
  if (open) {
    weeks = Math.min(4, maxWeeks)
    failure = null
  }
})

async function submit(event: Event) {
  event.preventDefault()
  if (working) return
  working = true
  failure = null
  try {
    await download(weeks)
    onClose()
  } catch (error) {
    failure =
      error instanceof Error && error.message
        ? error.message
        : "Kunne ikke lage filen. Prøv igjen."
  } finally {
    working = false
  }
}
</script>

<Dialog.Root
  {open}
  onOpenChange={next => {
    if (!next) onClose()
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay class="noprint fixed inset-0 z-[60] bg-foreground/50" />
    <Dialog.Content
      data-slot="csv-range"
      class="noprint fixed top-1/2 left-1/2 z-[70] flex w-[min(28rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-base border-2 border-border bg-panel p-5 shadow-shadow outline-none"
    >
      <Dialog.Title class="text-xl font-heading">Last ned flere uker</Dialog.Title>
      <Dialog.Description class="text-sm">
        Lager én CSV-fil med én rad per plass, fra uka du ser på (uke {fromWeek})
        og så mange uker framover som du velger. Uker som ikke er publisert tas
        med, og kolonnen «Ukestatus» sier det.
      </Dialog.Description>
      <form class="flex flex-col gap-3" onsubmit={submit}>
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-heading">Antall uker</span>
          <select
            bind:value={weeks}
            class="rounded-base border-2 border-border bg-card p-2 text-base"
          >
            {#each choices as n (n)}
              <option value={n}>{n} uker: {rangeText(n)}</option>
            {/each}
          </select>
        </label>
        {#if failure}
          <p role="alert" class="rounded-base border-l-4 border-warn-red bg-card px-3 py-2 text-sm text-warn-red">
            {failure}
          </p>
        {/if}
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" class={buttonVariants({ variant: "neutral" })} onclick={onClose}>
            Avbryt
          </button>
          <button
            type="submit"
            class={cn(buttonVariants(), "bg-cta")}
            aria-disabled={working}
          >
            {working ? "Henter …" : "Last ned"}
          </button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
