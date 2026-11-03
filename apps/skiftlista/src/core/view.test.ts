import { describe, expect, it } from "vitest"
import { buildBoard, createStore, FIRST_WEEK } from "./fake"
import { filterPeople, fold, matches, summarize } from "./view"

describe("search", () => {
  it("folds å but keeps æ and ø", () => {
    expect(fold("Håkon")).toBe("hakon")
    expect(fold("Bjørn Ærø")).toBe("bjørn ærø")
    expect(matches("Bjørn", "bjorn")).toBe(false)
  })

  it("needs every typed word", () => {
    expect(matches("Ada B.", "ada b")).toBe(true)
    expect(matches("Ada B.", "ada k")).toBe(false)
  })
})

describe("summary", () => {
  const board = buildBoard(createStore(), 11, FIRST_WEEK)

  it("counts the seeded problems and open places", () => {
    const summary = summarize(board)
    expect(summary.problems.length).toBeGreaterThan(0)
    expect(summary.open.length).toBeGreaterThan(0)
    expect(summary.answered + summary.notAnswered.length).toBe(
      board.people.length,
    )
  })

  it("filters skiftledere and sorts fewest shifts first", () => {
    const list = filterPeople(board, "", "skiftledere", null)
    expect(list.every(person => person.is_skiftleder)).toBe(true)
    const counts = list.map(person => person.week_shifts)
    expect(counts).toEqual([...counts].sort((a, b) => a - b))
  })
})
