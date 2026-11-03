import { describe, expect, it } from "vitest"
import {
  appPlaceId,
  BASE,
  createHttpApi,
  NotSignedInError,
  realSlot,
  SEATS,
  toBoard,
  type WireBoard,
} from "./http"
import { RefusedError } from "./types"

function wireBoard(): WireBoard {
  const assignment = {
    assignment_id: 9,
    volunteer_id: 1,
    cannot_attend: false,
    swap_requested: false,
    training: null,
    problems: [],
  }
  return {
    bar: { id: 7, name: "Stjerne" },
    week_start: "2026-11-02",
    week_number: 45,
    version: "abc",
    status: "open",
    deadline: null,
    rows: [{ position: 1, label: "Dagskift", time_label: "11:00–17:00" }],
    shifts: [
      {
        shift_id: 1,
        day: "2026-11-02",
        position: 1,
        title: "Dagskift",
        time_label: "11:00–17:00",
        starts_at: "2026-11-02T11:00:00+01:00",
        ends_at: "2026-11-02T17:00:00+01:00",
        duration_minutes: 360,
        closed: false,
        answers: {},
        places: [
          // One slot (81) with three seats: one filled, two open.
          {
            slot_id: 81,
            seat: 0,
            kind: "skjenker",
            assignment,
            suggestion: null,
            needed: false,
          },
          {
            slot_id: 81,
            seat: 1,
            kind: "skjenker",
            assignment: null,
            suggestion: null,
            needed: true,
          },
          {
            slot_id: 81,
            seat: 2,
            kind: "skjenker",
            assignment: null,
            suggestion: null,
            needed: true,
          },
          {
            slot_id: 80,
            seat: 0,
            kind: "skiftleder",
            assignment: null,
            suggestion: null,
            needed: true,
          },
        ],
      },
    ],
    people: [
      {
        volunteer_id: 4,
        name: "Di Delta",
        is_skiftleder: false,
        week_shifts: 0,
        month_shifts: 0,
        answer_status: "ikke_svart",
        busy_days: [],
        note: null,
        max_shifts: null,
        tags: [],
      },
    ],
    fit: {
      "4": {
        "81": { ok: true, warnings: [] },
        "80": {
          ok: true,
          warnings: [{ text: "Kun for godkjente skiftledere", level: "red" }],
          needs_confirmation: true,
        },
      },
    },
    strip: [{ week_start: "2026-11-02", number: 45, status: "open" }],
    last_changed: null,
  }
}

describe("toBoard", () => {
  it("gives every seat of a slot its own app id and maps it back", () => {
    const board = toBoard(wireBoard())
    const ids = board.shifts[0].places.map(place => place.slot_id)

    expect(ids).toEqual([8100, 8101, 8102, 8000])
    expect(new Set(ids).size).toBe(ids.length)
    expect(appPlaceId(81, 2)).toBe(81 * SEATS + 2)
    expect(ids.map(realSlot)).toEqual([81, 81, 81, 80])
  })

  it("copies a slot's fit to each of its open seats only", () => {
    const fit = toBoard(wireBoard()).fit["4"]

    expect(Object.keys(fit).sort()).toEqual(["8000", "8101", "8102"])
    expect(fit["8101"]).toEqual({ ok: true, warnings: [] })
    expect(fit["8102"]).toBe(fit["8101"])
    expect(fit["8000"]).toMatchObject({ ok: true, needs_confirmation: true })
  })

  it("passes on which places still have to be filled", () => {
    const places = toBoard(wireBoard()).shifts[0].places

    expect(places.map(place => place.needed)).toEqual([false, true, true, true])
  })

  it("keeps a person's hours and defaults a missing value to 0", () => {
    const wire = wireBoard()
    expect(toBoard(wire).people[0].week_minutes).toBe(0)
    wire.people[0].week_minutes = 420
    expect(toBoard(wire).people[0].week_minutes).toBe(420)
  })
})

describe("the http client", () => {
  const reply = (status: number, body: unknown) =>
    (async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch

  it("asks Personal for the week of a bar", async () => {
    const calls: string[] = []
    const api = createHttpApi((async (url: string) => {
      calls.push(url)
      return new Response(JSON.stringify(wireBoard()), { status: 200 })
    }) as typeof fetch)

    const board = await api.week(7, "2026-11-02")

    expect(calls).toEqual([`${BASE}/weeks/2026-11-02?group_id=7`])
    expect(board.bar.name).toBe("Stjerne")
  })

  it("says not signed in on 401", async () => {
    const api = createHttpApi(
      reply(401, { detail: "Authentication required." }),
    )
    await expect(api.me()).rejects.toBeInstanceOf(NotSignedInError)
  })

  it("passes Personal's Norwegian text on", async () => {
    const api = createHttpApi(
      reply(403, { detail: "Du har ikke tilgang til å se skiftplanen." }),
    )
    await expect(api.week(9, "2026-11-02")).rejects.toThrow(
      "Du har ikke tilgang til å se skiftplanen.",
    )
  })

  it("has a fallback text when the answer is not JSON", async () => {
    const api = createHttpApi(
      (async () =>
        new Response("<html>Bad gateway</html>", {
          status: 502,
        })) as typeof fetch,
    )
    await expect(api.me()).rejects.toThrow("Personal svarte 502")
  })

  it("does not write yet and says so", async () => {
    const api = createHttpApi(reply(200, {}))
    await expect(
      api.place(toBoard(wireBoard()), 8101, 4),
    ).rejects.toBeInstanceOf(RefusedError)
  })
})
