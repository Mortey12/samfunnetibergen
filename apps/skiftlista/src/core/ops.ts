/**
 * Leader actions in place terms (slot ids, not assignment ids), so an undo
 * entry stays valid after the server hands out new assignment ids. "Angre"
 * is client side (decided in Personal's HANDOFF, item 8): each action stores
 * its inverse, and undoing runs the inverse through the normal endpoints, so
 * the server checks every rule again and may refuse.
 */

import type { LeaderApi, Place, WeekBoard, WriteResult } from "./types"

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
  }
}

/** Runs an action against the current week. */
export function run(
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
  }
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
