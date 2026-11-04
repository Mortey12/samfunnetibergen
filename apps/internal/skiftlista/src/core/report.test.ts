import { describe, expect, it, vi } from "vitest"
import { NotSignedInError } from "./http"
import {
  createReporter,
  ERRORS_URL,
  installErrorReporting,
  MAX_REPORTS,
  toClientError,
} from "./report"
import { RefusedError } from "./types"

const options = (fetchFn: typeof fetch, enabled = true) => ({
  enabled,
  fetchFn,
  environment: "preview",
  version: "2026-11-04",
  path: () => "/",
})

const ok = () => vi.fn(async () => new Response("{}", { status: 200 }))

describe("toClientError", () => {
  it("keeps the class name and the message, and tags the source", () => {
    const body = toClientError(
      new TypeError("x is undefined"),
      "skiftlista:production:1 /",
    )
    expect(body).toEqual({
      error_type: "TypeError",
      error_text: "x is undefined",
      error_source: "skiftlista:production:1 /",
    })
  })

  it("removes anything that looks like an email address and cuts long text", () => {
    const body = toClientError(
      new Error(
        `Kunne ikke sende til ola.nordmann@example.dev ${"x".repeat(500)}`,
      ),
      "s",
    )
    expect(body?.error_text).not.toContain("example.dev")
    expect(body?.error_text).toContain("[email]")
    expect(body?.error_text.length).toBeLessThanOrEqual(300)
  })

  it("never reports Personal's own refusals or the sign-in state", () => {
    expect(
      toClientError(new RefusedError("Sander er allerede på skiftet."), "s"),
    ).toBeNull()
    expect(
      toClientError(new NotSignedInError("Ikke logget inn."), "s"),
    ).toBeNull()
  })

  it("copes with things that are not errors", () => {
    expect(toClientError("tekst", "s")?.error_type).toBe("Error")
  })
})

describe("createReporter", () => {
  it("does nothing when it is off (fake data)", async () => {
    const fetchFn = ok()
    expect(
      await createReporter(options(fetchFn, false)).report(new Error("a")),
    ).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("posts to Personal with the environment in the source and no stack", async () => {
    const fetchFn = ok()
    expect(await createReporter(options(fetchFn)).report(new Error("a"))).toBe(
      true,
    )
    const [url, init] = fetchFn.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(ERRORS_URL)
    const body = JSON.parse(String(init.body))
    expect(body.error_source).toBe("skiftlista:preview:2026-11-04 /")
    expect(Object.keys(body).sort()).toEqual([
      "error_source",
      "error_text",
      "error_type",
    ])
  })

  it("sends each distinct error once and stops after the limit", async () => {
    const fetchFn = ok()
    const reporter = createReporter(options(fetchFn))
    await reporter.report(new Error("same"))
    expect(await reporter.report(new Error("same"))).toBe(false)
    for (let i = 0; i < 10; i++)
      await reporter.report(new Error(`different ${i}`))
    expect(fetchFn).toHaveBeenCalledTimes(MAX_REPORTS)
  })

  it("never throws, also when the network fails", async () => {
    const failing = vi.fn(async () => {
      throw new Error("offline")
    })
    expect(
      await createReporter(options(failing as unknown as typeof fetch)).report(
        new Error("a"),
      ),
    ).toBe(false)
  })
})

describe("installErrorReporting", () => {
  it("listens for errors and unhandled rejections and can be removed", () => {
    const listeners = new Map<string, (event: never) => void>()
    const target = {
      addEventListener: (name: string, fn: (event: never) => void) =>
        listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name),
    }
    const report = vi.fn(async () => true)
    const remove = installErrorReporting(
      { report },
      target as unknown as Window,
    )
    listeners.get("error")?.({ error: new Error("boom") } as never)
    listeners.get("unhandledrejection")?.({
      reason: new Error("late"),
    } as never)
    expect(report).toHaveBeenCalledTimes(2)
    remove()
    expect(listeners.size).toBe(0)
  })
})
