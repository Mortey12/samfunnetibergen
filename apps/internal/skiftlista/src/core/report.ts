/**
 * Error tracking for the live app: an unexpected error in the browser is sent
 * to Personal's existing `client-errors` route (signed-in users only, rate
 * limited, run through Personal's sanitizer, then to its logs). Nothing goes
 * to a third party from the browser, so there is no token to configure and
 * nothing to leak: the app is off in fake mode (`enabled: false`).
 *
 * What is sent, and what is not:
 *
 * - Sent: the error's class name, its message cut to 300 characters with
 *   anything that looks like an email address removed, and a source label
 *   (`skiftlista:<environment>:<version> <path>`). The environment is in every
 *   report, so a preview or a rehearsal never looks like the real thing.
 * - Never sent: stacks, the query string (bar and week), the board, any
 *   person. Errors that carry Personal's own texts (`RefusedError`, which can
 *   name a volunteer) and the sign-in error are expected states and are not
 *   reported at all.
 * - At most `MAX_REPORTS` per page load and each distinct error once, so a
 *   loop cannot flood the route.
 */

import { RefusedError } from "./types"

export const ERRORS_URL = "/personal/api/v1/telemetry/client-errors/"
export const MAX_REPORTS = 5

export interface ClientErrorBody {
  error_type: string
  error_text: string
  error_source: string
}

const EMAIL = /[^\s@<>()"',;]+@[^\s@<>()"',;]+/g

/** Names the classes that are expected states, not bugs (kept by name so this file needs no import cycle). */
function isExpected(error: unknown): boolean {
  return (
    error instanceof RefusedError ||
    (error instanceof Error && error.constructor.name === "NotSignedInError")
  )
}

export function toClientError(
  error: unknown,
  source: string,
): ClientErrorBody | null {
  if (isExpected(error)) return null
  const type = error instanceof Error ? error.name : "Error"
  const raw = error instanceof Error ? error.message : String(error)
  return {
    error_type: (type || "Error").slice(0, 120),
    error_text: raw.replace(EMAIL, "[email]").slice(0, 300),
    error_source: source.slice(0, 250),
  }
}

interface ReporterOptions {
  enabled: boolean
  fetchFn?: typeof fetch
  environment: string
  version: string
  /** The page's path (never the query string). */
  path: () => string
}

export function createReporter(options: ReporterOptions) {
  const seen = new Set<string>()
  let sent = 0
  const send = options.fetchFn ?? ((...args) => fetch(...args))
  return {
    /** Resolves true when a report was sent. Never throws: reporting must not cause errors. */
    async report(error: unknown): Promise<boolean> {
      if (!options.enabled || sent >= MAX_REPORTS) return false
      const body = toClientError(
        error,
        `skiftlista:${options.environment}:${options.version} ${options.path()}`,
      )
      if (!body) return false
      const key = `${body.error_type}:${body.error_text}`
      if (seen.has(key)) return false
      seen.add(key)
      sent += 1
      try {
        const response = await send(ERRORS_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
        })
        return response.ok
      } catch {
        return false
      }
    },
  }
}

/** Reports what nothing else caught. Returns a function that removes the listeners. */
export function installErrorReporting(
  reporter: ReturnType<typeof createReporter>,
  target: Pick<Window, "addEventListener" | "removeEventListener">,
): () => void {
  const onError = (event: ErrorEvent) => void reporter.report(event.error)
  const onRejection = (event: PromiseRejectionEvent) =>
    void reporter.report(event.reason)
  target.addEventListener("error", onError)
  target.addEventListener("unhandledrejection", onRejection)
  return () => {
    target.removeEventListener("error", onError)
    target.removeEventListener("unhandledrejection", onRejection)
  }
}
