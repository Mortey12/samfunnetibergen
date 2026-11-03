/**
 * The real `LeaderApi`: reads from Personal through the same-origin path
 * `/personal/*` (Vite's proxy in development, a Vercel rewrite when hosted).
 * The session cookie travels with every request; the app never sees a token
 * except the CSRF token that `GET /me` hands out for later writes.
 *
 * Personal's JSON is translated here and nowhere else:
 *
 * - A slot with room for several people has ONE slot id in Personal. Each box
 *   gets its own app id `slot_id * SEATS + seat`, so every box on the page is
 *   unique. Writes turn it back with `realSlot()`.
 * - `fit` is given per slot; it is copied to every open seat of the slot.
 */

import {
  type Assignment,
  type Fit,
  type LeaderApi,
  type LeaderMe,
  type Note,
  type Person,
  type Place,
  type PlaceKind,
  RefusedError,
  type Shift,
  type WeekBoard,
  type WeekStatus,
  type WriteResult,
} from "./types"

/** Seats per slot that the app id leaves room for. */
export const SEATS = 100

export const BASE = "/personal/api/v1/leader/shifts"

export const appPlaceId = (slotId: number, seat: number): number =>
  slotId * SEATS + seat

export const realSlot = (placeId: number): number => Math.floor(placeId / SEATS)

/** Not signed in to Personal (401): the app shows a link to the login. */
export class NotSignedInError extends Error {}

// ---- Personal's JSON (see openapi.json, tag leader-shifts, in Personal) ----

interface WireAssignment extends Assignment {}

interface WirePlace {
  slot_id: number
  seat: number
  kind: PlaceKind
  assignment: WireAssignment | null
  suggestion: Place["suggestion"]
  needed: boolean
}

interface WireShift extends Omit<Shift, "places"> {
  places: WirePlace[]
}

export type WireFit =
  | { ok: true; warnings: Note[]; needs_confirmation?: boolean }
  | { ok: false; reason: string }

export interface WireBoard
  extends Omit<WeekBoard, "shifts" | "fit" | "status" | "people"> {
  status: WeekStatus
  shifts: WireShift[]
  people: (Omit<Person, "week_minutes"> & { week_minutes?: number })[]
  fit: Record<string, Record<string, WireFit>>
}

/** Personal's board as the app's `WeekBoard`. */
export function toBoard(wire: WireBoard): WeekBoard {
  const shifts: Shift[] = wire.shifts.map(shift => ({
    ...shift,
    places: shift.places.map(place => ({
      slot_id: appPlaceId(place.slot_id, place.seat),
      kind: place.kind,
      assignment: place.assignment,
      suggestion: place.suggestion,
      needed: place.needed,
    })),
  }))

  // Open (or "kan ikke i dag") seats per real slot, to spread the fit.
  const openSeats = new Map<number, number[]>()
  for (const shift of wire.shifts) {
    for (const place of shift.places) {
      if (place.assignment && !place.assignment.cannot_attend) continue
      const list = openSeats.get(place.slot_id) ?? []
      list.push(appPlaceId(place.slot_id, place.seat))
      openSeats.set(place.slot_id, list)
    }
  }
  const fit: WeekBoard["fit"] = {}
  for (const [volunteerId, perSlot] of Object.entries(wire.fit)) {
    const spread: Record<string, Fit> = {}
    for (const [slotId, value] of Object.entries(perSlot)) {
      for (const placeId of openSeats.get(Number(slotId)) ?? [])
        spread[placeId] = value
    }
    fit[volunteerId] = spread
  }

  return {
    ...wire,
    shifts,
    fit,
    people: wire.people.map(person => ({
      ...person,
      week_minutes: person.week_minutes ?? 0,
    })),
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (response.status === 401) throw new NotSignedInError("Ikke logget inn.")
  if (!response.ok) {
    let detail = ""
    try {
      detail = ((await response.json()) as { detail?: unknown })
        .detail as string
    } catch {
      // Not JSON (for example a proxy error page): fall through.
    }
    throw new RefusedError(
      typeof detail === "string" && detail
        ? detail
        : `Personal svarte ${response.status}. Prøv igjen.`,
    )
  }
  return (await response.json()) as T
}

const NOT_BUILT =
  "Å endre skiftlista mot Personal er ikke bygd ennå. Du kan bare se uka."

export function createHttpApi(fetchFn: typeof fetch = fetch): LeaderApi {
  const refuse = async (): Promise<WriteResult> => {
    throw new RefusedError(NOT_BUILT)
  }
  return {
    async me(): Promise<LeaderMe> {
      const response = await fetchFn(`${BASE}/me`, {
        credentials: "same-origin",
      })
      return readJson<LeaderMe>(response)
    },
    async week(groupId: number, weekStart: string): Promise<WeekBoard> {
      const response = await fetchFn(
        `${BASE}/weeks/${weekStart}?group_id=${groupId}`,
        { credentials: "same-origin" },
      )
      return toBoard(await readJson<WireBoard>(response))
    },
    place: refuse,
    replace: refuse,
    move: refuse,
    swap: refuse,
    remove: refuse,
    setStatus: refuse,
  }
}
