<!-- "Meld feil": a small form in a modal. The leader writes what happened; the
     server adds who, which bar and week, and the environment. The text says
     not to write volunteers' names. A failed send is shown as a failure, never
     as thanks, so nobody believes a report was sent when it was not. -->
<script lang="ts">
import { Dialog } from "bits-ui"
import { buttonVariants } from "./button"
import { cn } from "./cn"

interface Props {
  open: boolean
  /** Sends the text; resolves with the thank-you, rejects with the reason. */
  send: (message: string) => Promise<string>
  onClose: () => void
}

let { open, send, onClose }: Props = $props()

const MAX = 1500
let text = $state("")
let sending = $state(false)
let thanks = $state<string | null>(null)
let failure = $state<string | null>(null)
let field = $state<HTMLTextAreaElement | null>(null)

// A fresh form every time it opens.
$effect(() => {
  if (open) {
    text = ""
    thanks = null
    failure = null
  }
})

async function submit(event: Event) {
  event.preventDefault()
  if (sending || !text.trim()) return
  sending = true
  failure = null
  try {
    thanks = await send(text.trim())
  } catch (error) {
    failure =
      error instanceof Error && error.message
        ? error.message
        : "Feilmeldingen ble ikke sendt. Prøv igjen."
  } finally {
    sending = false
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
      data-slot="report"
      onOpenAutoFocus={event => {
        event.preventDefault()
        field?.focus()
      }}
      class="noprint fixed top-1/2 left-1/2 z-[70] flex w-[min(30rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 overflow-y-auto rounded-base border-2 border-border bg-panel p-5 shadow-shadow outline-none"
    >
      <Dialog.Title class="text-xl font-heading">Meld feil</Dialog.Title>
      <Dialog.Description class="text-sm">
        Skriv hva som skjedde og hva du ventet. Ikke skriv navn på frivillige.
        Vi ser hvem du er, hvilken bar og uke du var på, og hvilken versjon
        appen er.
      </Dialog.Description>
      {#if thanks}
        <p role="status" class="rounded-base border-l-4 border-border bg-card px-3 py-2 text-sm">
          {thanks}
        </p>
        <div class="flex justify-end">
          <button type="button" class={buttonVariants()} onclick={onClose}>
            Lukk
          </button>
        </div>
      {:else}
        <form class="flex flex-col gap-3" onsubmit={submit}>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-heading">Hva skjedde?</span>
            <textarea
              bind:this={field}
              bind:value={text}
              maxlength={MAX}
              rows="5"
              required
              class="rounded-base border-2 border-border bg-card p-2 text-base"
            ></textarea>
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
              aria-disabled={sending || !text.trim()}
            >
              {sending ? "Sender …" : "Send"}
            </button>
          </div>
        </form>
      {/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
