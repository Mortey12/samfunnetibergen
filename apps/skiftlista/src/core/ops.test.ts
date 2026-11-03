import { describe, expect, it } from "vitest"
import { createFakeApi, createStore, FIRST_WEEK } from "./fake"
import {
  inverseOf,
  occupant,
  pushUndo,
  run,
  UNDO_LIMIT,
  type UndoEntry,
} from "./ops"
import type { WeekBoard } from "./types"
import { confirmationFor, isOpen } from "./view"

const STJERNE = 11

async function setup() {
  const api = createFakeApi(createStore(), 0)
  const board = await api.week(STJERNE, FIRST_WEEK)
  return { api, board }
}

function emptySkjenker(board: WeekBoard) {
  for (const shift of board.shifts)
    for (const place of shift.places)
      if (place.kind === "skjenker" && isOpen(place) && !place.assignment)
        return { shift, place }
  throw new Error("no empty place")
}

function freePersonFor(board: WeekBoard, slotId: number) {
  const person = board.people.find(
    candidate => board.fit[candidate.volunteer_id]?.[slotId]?.ok,
  )
  if (!person) throw new Error("no one fits")
  return person
}

describe("undo", () => {
  it("removes a placed person again", async () => {
    const { api, board } = await setup()
    const { place } = emptySkjenker(board)
    const person = freePersonFor(board, place.slot_id)
    const op = {
      type: "place" as const,
      slotId: place.slot_id,
      volunteerId: person.volunteer_id,
    }
    const inverse = inverseOf(op, board)
    const placed = await run(api, board, op)
    expect(occupant(placed.board, place.slot_id)).toBe(person.volunteer_id)
    if (!inverse) throw new Error("no inverse")
    const undone = await run(api, placed.board, inverse)
    expect(occupant(undone.board, place.slot_id)).toBeNull()
  })

  it("puts a removed person back", async () => {
    const { api, board } = await setup()
    const filled = board.shifts
      .flatMap(shift => shift.places)
      .find(place => place.assignment && !place.assignment.cannot_attend)
    if (!filled?.assignment) throw new Error("no filled place")
    const op = { type: "remove" as const, slotId: filled.slot_id }
    const inverse = inverseOf(op, board)
    const removed = await run(api, board, op)
    if (!inverse) throw new Error("no inverse")
    const undone = await run(api, removed.board, inverse)
    expect(occupant(undone.board, filled.slot_id)).toBe(
      filled.assignment.volunteer_id,
    )
  })

  it("swaps back by swapping again", async () => {
    const { api, board } = await setup()
    const filled = board.shifts
      .filter(shift => shift.day === FIRST_WEEK)
      .flatMap(shift => shift.places)
      .filter(
        place =>
          place.kind === "skiftleder" &&
          place.assignment &&
          !place.assignment.cannot_attend,
      )
    expect(filled.length).toBeGreaterThanOrEqual(2)
    const [a, b] = filled
    const op = { type: "swap" as const, slotA: a.slot_id, slotB: b.slot_id }
    const swapped = await run(api, board, op)
    expect(occupant(swapped.board, a.slot_id)).toBe(b.assignment?.volunteer_id)
    const inverse = inverseOf(op, board)
    if (!inverse) throw new Error("no inverse")
    const undone = await run(api, swapped.board, inverse)
    expect(occupant(undone.board, a.slot_id)).toBe(a.assignment?.volunteer_id)
  })

  it("takes a new place away again, and puts a removed one back", async () => {
    const { api, board } = await setup()
    const shift = board.shifts.find(item =>
      item.places.some(place => place.kind === "skjenker"),
    )
    if (!shift) throw new Error("no shift")
    const count = (b: WeekBoard) =>
      b.shifts
        .find(item => item.shift_id === shift.shift_id)
        ?.places.filter(place => place.kind === "skjenker").length ?? 0
    const before = count(board)

    const add = {
      type: "addPlace" as const,
      shiftId: shift.shift_id,
      kind: "skjenker" as const,
    }
    const added = await run(api, board, add)
    expect(count(added.board)).toBe(before + 1)

    const minus = inverseOf(add, board)
    expect(minus).toEqual({ ...add, type: "removePlace" })
    if (!minus) throw new Error("no inverse")
    const removed = await run(api, added.board, minus)
    expect(count(removed.board)).toBe(before)
    expect(inverseOf(minus, added.board)).toEqual(add)
  })

  it("minus never takes a person off", async () => {
    const { api, board } = await setup()
    // A shift where every place of a kind is taken.
    const shift = board.shifts.find(item =>
      item.places.some(
        place => place.kind === "skiftleder" && place.assignment,
      ),
    )
    if (!shift) throw new Error("no full place")
    const op = {
      type: "removePlace" as const,
      shiftId: shift.shift_id,
      kind: "skiftleder" as const,
    }
    const kinds = shift.places.filter(place => place.kind === "skiftleder")
    expect(kinds.every(place => place.assignment)).toBe(true)
    await expect(run(api, board, op)).rejects.toThrow("er i bruk")
  })

  it("keeps the last twenty steps", () => {
    let stack: UndoEntry[] = Array.from({ length: UNDO_LIMIT }, (_, index) => ({
      weekKey: "w",
      label: String(index),
      inverse: { type: "remove" as const, slotId: index },
    }))
    stack = pushUndo(stack, {
      weekKey: "w",
      label: "new",
      inverse: { type: "remove", slotId: 99 },
    })
    expect(stack).toHaveLength(UNDO_LIMIT)
    expect(stack[0].label).toBe("1")
    expect(stack.at(-1)?.label).toBe("new")
  })
})

describe("fake server refusals", () => {
  it("asks for a confirmation before a non-skiftleder takes a skiftleder place", async () => {
    const { api, board } = await setup()
    const slPlace = board.shifts
      .flatMap(shift => shift.places)
      .find(place => place.kind === "skiftleder" && !place.assignment)
    const notSl = board.people.find(
      person =>
        !person.is_skiftleder &&
        board.fit[person.volunteer_id]?.[slPlace?.slot_id ?? 0]?.ok,
    )
    if (!slPlace || !notSl) throw new Error("setup")
    const fit = board.fit[notSl.volunteer_id][slPlace.slot_id]
    expect(fit.ok && fit.needs_confirmation).toBe(true)
    expect(fit.ok && fit.warnings[0]).toEqual({
      text: "bare godkjente skiftledere",
      level: "red",
    })
    // Without the leader's confirmation the server says no ...
    await expect(
      api.place(board, slPlace.slot_id, notSl.volunteer_id),
    ).rejects.toThrow("mangler godkjenning")
    // ... with it, the person is placed.
    const result = await api.place(
      board,
      slPlace.slot_id,
      notSl.volunteer_id,
      true,
    )
    expect(result.message).toContain("er satt opp som skiftleder")
  })

  it("confirmationFor asks only for place, replace and move of an unqualified person", async () => {
    const { board } = await setup()
    const slPlace = board.shifts
      .flatMap(shift => shift.places)
      .find(place => place.kind === "skiftleder" && !place.assignment)
    const notSl = board.people.find(
      person =>
        !person.is_skiftleder &&
        board.fit[person.volunteer_id]?.[slPlace?.slot_id ?? 0]?.ok,
    )
    const sl = board.people.find(person => person.is_skiftleder)
    if (!slPlace || !notSl || !sl) throw new Error("setup")
    const op = {
      type: "place",
      slotId: slPlace.slot_id,
      volunteerId: notSl.volunteer_id,
    } as const
    expect(confirmationFor(board, op)?.person.volunteer_id).toBe(
      notSl.volunteer_id,
    )
    expect(confirmationFor(board, { ...op, confirmed: true })).toBeNull()
    expect(
      confirmationFor(board, { ...op, volunteerId: sl.volunteer_id }),
    ).toBeNull()
    expect(
      confirmationFor(board, { type: "status", status: "published" }),
    ).toBeNull()
  })

  it("refuses a write on a stale copy of the week", async () => {
    const { api, board } = await setup()
    const { place } = emptySkjenker(board)
    const person = freePersonFor(board, place.slot_id)
    await api.place(board, place.slot_id, person.volunteer_id)
    await expect(api.setStatus(board, "published")).rejects.toThrow(
      "En annen leder",
    )
  })

  it("marks a published week as changed after a write", async () => {
    const { api, board } = await setup()
    const published = await api.setStatus(board, "published")
    const { place } = emptySkjenker(published.board)
    const person = freePersonFor(published.board, place.slot_id)
    const changed = await api.place(
      published.board,
      place.slot_id,
      person.volunteer_id,
    )
    expect(changed.board.status).toBe("changed_after_publish")
  })
})
