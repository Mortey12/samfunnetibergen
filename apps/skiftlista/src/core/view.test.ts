import { describe, expect, it } from "vitest"
import { buildBoard, createStore, FIRST_WEEK, minutesBetween } from "./fake"
import {
  addableKinds,
  changedBy,
  filterPeople,
  fold,
  hoursText,
  matches,
  summarize,
} from "./view"

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

describe("hoursText", () => {
  it("words planned minutes as hours", () => {
    expect(hoursText(0)).toBe("0 min")
    expect(hoursText(45)).toBe("45 min")
    expect(hoursText(360)).toBe("6 t")
    expect(hoursText(390)).toBe("6 t 30 min")
  })
})

describe("shift length", () => {
  it("counts a shift past midnight as the next day", () => {
    expect(minutesBetween("11:00", "17:00")).toBe(360)
    expect(minutesBetween("19:30", "01:30")).toBe(360)
  })

  it("adds up the hours a person is coming to", () => {
    const board = buildBoard(createStore(), 11, FIRST_WEEK)
    const worked = board.people.filter(person => person.week_shifts > 0)
    expect(worked.length).toBeGreaterThan(0)
    for (const person of worked)
      expect(person.week_minutes).toBeGreaterThanOrEqual(0)
    expect(board.shifts.every(shift => (shift.duration_minutes ?? 0) > 0)).toBe(
      true,
    )
  })
})

describe("ledige", () => {
  it("counts the places that must be filled, not every empty box", () => {
    const board = buildBoard(createStore(), 11, FIRST_WEEK)
    const place = board.shifts[0].places[0]
    // An empty Opplæring place is an extra: it is open but not needed.
    place.assignment = null
    place.needed = false
    const before = summarize(board).open.length
    place.needed = true
    expect(summarize(board).open.length).toBe(before + 1)
  })

  it("treats a place without the flag as needed when it is empty", () => {
    const board = buildBoard(createStore(), 11, FIRST_WEEK)
    const empty = board.shifts
      .flatMap(shift => shift.places)
      .filter(place => !place.assignment)
    expect(empty.length).toBeGreaterThan(0)
    expect(summarize(board).open.length).toBeGreaterThanOrEqual(empty.length)
  })
})

describe("what plus offers", () => {
  it("is Skjenker for a bar, never Skiftleder or Opplæring", () => {
    const board = buildBoard(createStore(), 11, FIRST_WEEK)
    expect(addableKinds(board)).toEqual(["skjenker"])
  })

  it("is Kokk, not Skjenker, where the bar has kokk places (the kitchen)", () => {
    const board = buildBoard(createStore(), 11, FIRST_WEEK)
    board.shifts[0].places.push({
      slot_id: 99999,
      kind: "kokk",
      assignment: null,
      suggestion: null,
    })
    expect(addableKinds(board)).toEqual(["kokk"])
  })
})

describe("who changed the week", () => {
  it("says who and when, in Oslo time", () => {
    expect(
      changedBy({ by: "Stjerne Leder", at: "2026-11-03T13:05:00+00:00" }),
    ).toMatch(/^Sist endret av Stjerne Leder, kl\. 14[:.]05\.$/)
  })

  it("says nothing when nobody changed it", () => {
    expect(changedBy(null)).toBe("")
  })
})
