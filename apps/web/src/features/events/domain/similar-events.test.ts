import { describe, expect, it } from "vitest"

import {
  type PublicEvent,
  type RawPublicEvent,
  resolvePublicEvent,
} from "./events"
import { rankSimilarEvents, similarityScore } from "./similar-events"

const TODAY = "2026-11-02"

const music = { _id: "music", name: "Musikk" }
const talks = { _id: "talks", name: "Foredrag" }
const concert = { _id: "concert", name: "Konsert", taxonomyGroup: music }
const club = { _id: "club", name: "Klubb", taxonomyGroup: music }
const lecture = { _id: "lecture", name: "Foredrag", taxonomyGroup: talks }
const group = (_id: string) => ({ _id, name: _id, slug: _id })

function event(
  _id: string,
  startDate: string,
  fields: Partial<RawPublicEvent> = {},
): PublicEvent {
  return resolvePublicEvent({
    _id,
    title: _id,
    slug: _id,
    eventStatus: "scheduled",
    dates: [{ _key: startDate, startDate, startTime: "20:00" }],
    ...fields,
  })
}

const ids = (events: PublicEvent[]) => events.map(candidate => candidate._id)

describe("similarityScore", () => {
  it("adds points for every shared signal", () => {
    const shown = event("shown", "2026-11-10", {
      eventType: concert,
      organizerGroup: group("band"),
      room: { _id: "teglverket" } as PublicEvent["room"],
      isFree: true,
    })
    const twin = event("twin", "2026-11-05", {
      eventType: concert,
      coOrganizerGroups: [group("band")],
      room: { _id: "teglverket" } as PublicEvent["room"],
      isFree: true,
    })

    // type 5 + category 3 + organizer 3 + room 1 + free 1 + within a week 2
    expect(similarityScore(shown, twin, "2026-11-05", TODAY)).toBe(15)
  })

  it("scores only nearness for an unrelated event", () => {
    const shown = event("shown", "2026-11-10", { eventType: concert })
    const other = event("other", "2026-11-20", { eventType: lecture })

    expect(similarityScore(shown, other, "2026-11-20", TODAY)).toBe(1)
    expect(similarityScore(shown, other, "2026-12-20", TODAY)).toBe(0)
  })
})

describe("rankSimilarEvents", () => {
  it("ranks by score, then by the soonest date", () => {
    const shown = event("shown", "2026-11-10", { eventType: concert })
    const candidates = [
      event("club-soon", "2026-11-04", { eventType: club }),
      event("concert-later", "2026-12-01", { eventType: concert }),
      event("concert-soon", "2026-11-05", { eventType: concert }),
      event("lecture", "2026-11-03", { eventType: lecture }),
    ]

    expect(ids(rankSimilarEvents(shown, candidates, TODAY))).toEqual([
      "concert-soon",
      "concert-later",
      "club-soon",
    ])
  })

  it("skips the event itself, cancelled, sold-out, past and far-off events", () => {
    const shown = event("shown", "2026-11-10", { eventType: concert })
    const candidates = [
      shown,
      event("cancelled", "2026-11-05", {
        eventType: concert,
        eventStatus: "cancelled",
      }),
      event("sold-out", "2026-11-05", { eventType: concert, isSoldOut: true }),
      event("past", "2026-10-01", { eventType: concert }),
      event("far-off", "2027-02-01", { eventType: concert }),
      event("ok-1", "2026-11-06", { eventType: concert }),
      event("ok-2", "2026-11-07", { eventType: concert }),
    ]

    expect(ids(rankSimilarEvents(shown, candidates, TODAY))).toEqual([
      "ok-1",
      "ok-2",
    ])
  })

  it("never shows other dates of the same series", () => {
    const series = { _id: "quiz-series", eventKind: "seriesParent" }
    const shown = event("quiz-1", "2026-11-05", {
      eventKind: "seriesInstance",
      parent: series,
      eventType: concert,
    })
    const candidates = [
      event("quiz-2", "2026-11-12", {
        eventKind: "seriesInstance",
        parent: series,
        eventType: concert,
      }),
      event("a", "2026-11-06", { eventType: concert }),
      event("b", "2026-11-07", { eventType: concert }),
    ]

    expect(ids(rankSimilarEvents(shown, candidates, TODAY))).toEqual(["a", "b"])
  })

  it("gives one slot per series, festival and organizer group", () => {
    const shown = event("shown", "2026-11-10", { eventType: concert })
    const festival = { _id: "fest", eventKind: "festivalParent" }
    const candidates = [
      event("fest-1", "2026-11-04", {
        eventKind: "festivalSession",
        parent: festival,
        eventType: concert,
      }),
      event("fest-2", "2026-11-05", {
        eventKind: "festivalSession",
        parent: festival,
        eventType: concert,
      }),
      event("band-1", "2026-11-06", {
        eventType: concert,
        organizerGroup: group("band"),
      }),
      event("band-2", "2026-11-07", {
        eventType: concert,
        organizerGroup: group("band"),
      }),
      event("other", "2026-11-08", { eventType: concert }),
    ]

    expect(ids(rankSimilarEvents(shown, candidates, TODAY))).toEqual([
      "fest-1",
      "band-1",
      "other",
    ])
  })

  it("fills open slots with the soonest events in the same category", () => {
    const shown = event("shown", "2026-11-10", { eventType: concert })
    const candidates = [
      event("strong", "2026-11-20", { eventType: concert }),
      event("same-category-later", "2026-12-20", { eventType: club }),
      event("same-category-sooner", "2026-12-10", { eventType: club }),
      event("unrelated", "2026-11-03", { eventType: lecture }),
    ]

    expect(ids(rankSimilarEvents(shown, candidates, TODAY))).toEqual([
      "strong",
      "same-category-sooner",
      "same-category-later",
    ])
  })

  it("returns nothing below two matches, and nothing for festivals", () => {
    const shown = event("shown", "2026-11-10", { eventType: concert })
    const candidates = [
      event("only", "2026-11-05", { eventType: concert }),
      event("unrelated", "2026-11-04", { eventType: lecture }),
    ]
    const festival = event("fest", "2026-11-10", {
      eventKind: "festivalParent",
      eventType: concert,
    })
    const many = [
      event("a", "2026-11-05", { eventType: concert }),
      event("b", "2026-11-06", { eventType: concert }),
    ]

    expect(rankSimilarEvents(shown, candidates, TODAY)).toEqual([])
    expect(rankSimilarEvents(festival, many, TODAY)).toEqual([])
  })
})
