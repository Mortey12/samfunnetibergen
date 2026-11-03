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
import { isOpen } from "./view"

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
  it("refuses a non-skiftleder on a skiftleder place", async () => {
    const { api, board } = await setup()
    const slPlace = board.shifts
      .flatMap(shift => shift.places)
      .find(place => place.kind === "skiftleder" && !place.assignment)
    const notSl = board.people.find(person => !person.is_skiftleder)
    if (!slPlace || !notSl) throw new Error("setup")
    await expect(
      api.place(board, slPlace.slot_id, notSl.volunteer_id),
    ).rejects.toThrow("bare godkjente skiftledere")
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
