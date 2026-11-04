/**
 * Leader actions in place terms (slot ids, not assignment ids), so an undo
 * entry stays valid after the server hands out new assignment ids. "Angre"
 * is client side (decided in Personal's HANDOFF, item 8): each action stores
 * its inverse, and undoing runs the inverse through the normal endpoints, so
 * the server checks every rule again and may refuse.
 */

import {
  type LeaderApi,
  type Place,
  type PlaceKind,
  RefusedError,
  type WeekBoard,
  type WriteResult,
} from "./types"

/**
 * `confirmed` is set once the leader accepted the big warning for a person
 * who lacks the qualification (the popup in App.svelte), and on undo
 * actions, which only put back what the leader already confirmed.
 */
export type Op =
  | { type: "place"; slotId: number; volunteerId: number; confirmed?: boolean }
  | { type: "remove"; slotId: number }
  | {
      type: "replace"
      slotId: number
      volunteerId: number
      confirmed?: boolean
    }
  | { type: "move"; fromSlotId: number; toSlotId: number; confirmed?: boolean }
  | { type: "swap"; slotA: number; slotB: number }
  | { type: "status"; status: "open" | "published" }
  /** "+": one more place of a kind on a shift. Addressed by shift and kind, not by place, so undo survives new ids. */
  | { type: "addPlace"; shiftId: number; kind: PlaceKind }
  /** "−": one empty place of a kind less. The inverse of addPlace. */
  | { type: "removePlace"; shiftId: number; kind: PlaceKind }

export const UNDO_LIMIT = 20

export function placeById(board: WeekBoard, slotId: number): Place | null {
  for (const shift of board.shifts) {
    const place = shift.places.find(candidate => candidate.slot_id === slotId)
    if (place) return place
  }
  return null
}

/** Who is on the place now (a "kan ikke i dag" person counts as gone). */
export function occupant(board: WeekBoard, slotId: number): number | null {
  const assignment = placeById(board, slotId)?.assignment
  return assignment && !assignment.cannot_attend
    ? assignment.volunteer_id
    : null
}

function assignmentAt(board: WeekBoard, slotId: number): number {
  const assignment = placeById(board, slotId)?.assignment
  if (!assignment) throw new Error(`No one on place ${slotId}`)
  return assignment.assignment_id
}

/** The action that puts things back, read from the week before `op` ran. */
export function inverseOf(op: Op, before: WeekBoard): Op | null {
  switch (op.type) {
    case "place":
      return { type: "remove", slotId: op.slotId }
    case "remove": {
      const volunteerId = occupant(before, op.slotId)
      return volunteerId === null
        ? null
        : { type: "place", slotId: op.slotId, volunteerId, confirmed: true }
    }
    case "replace": {
      const volunteerId = occupant(before, op.slotId)
      return volunteerId === null
        ? null
        : { type: "replace", slotId: op.slotId, volunteerId, confirmed: true }
    }
    case "move":
      return {
        type: "move",
        fromSlotId: op.toSlotId,
        toSlotId: op.fromSlotId,
        confirmed: true,
      }
    case "swap":
      return op
    case "status":
      return {
        type: "status",
        status: before.status === "open" ? "open" : "published",
      }
    case "addPlace":
      return { type: "removePlace", shiftId: op.shiftId, kind: op.kind }
    case "removePlace":
      return { type: "addPlace", shiftId: op.shiftId, kind: op.kind }
  }
}

/** Runs an action against the current week. */
export async function run(
  api: LeaderApi,
  board: WeekBoard,
  op: Op,
): Promise<WriteResult> {
  switch (op.type) {
    case "place":
      return api.place(board, op.slotId, op.volunteerId, op.confirmed)
    case "remove":
      return api.remove(board, assignmentAt(board, op.slotId))
    case "replace":
      return api.replace(
        board,
        assignmentAt(board, op.slotId),
        op.volunteerId,
        op.confirmed,
      )
    case "move":
      return api.move(
        board,
        assignmentAt(board, op.fromSlotId),
        op.toSlotId,
        op.confirmed,
      )
    case "swap":
      return api.swap(
        board,
        assignmentAt(board, op.slotA),
        assignmentAt(board, op.slotB),
      )
    case "status":
      return api.setStatus(board, op.status)
    case "addPlace":
      return api.addPlace(board, op.shiftId, op.kind)
    case "removePlace":
      return api.removePlace(board, emptyPlaceOf(board, op.shiftId, op.kind))
  }
}

/** The last empty place of a kind on a shift: the one "−" takes away. */
export function emptyPlaceOf(
  board: WeekBoard,
  shiftId: number,
  kind: PlaceKind,
): number {
  const shift = board.shifts.find(candidate => candidate.shift_id === shiftId)
  const empty = shift?.places.filter(
    place => place.kind === kind && place.assignment === null,
  )
  const last = empty?.at(-1)
  if (!last)
    throw new RefusedError(
      "Alle plassene av denne typen er i bruk. Ta personen av først.",
    )
  return last.slot_id
}

export interface UndoEntry {
  /** Which week the entry belongs to; undo only runs in that week. */
  weekKey: string
  label: string
  inverse: Op
}

export function pushUndo(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return [...stack, entry].slice(-UNDO_LIMIT)
}

export function weekKeyOf(board: WeekBoard): string {
  return `${board.bar.id}|${board.week_start}`
}
