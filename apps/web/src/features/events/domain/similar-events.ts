import type { PublicEvent } from "./events"
import { organizerGroupsOf } from "./eventUtils"

export const SIMILAR_EVENT_COUNT = 3
/** Below this many matches the section is hidden. */
export const SIMILAR_EVENT_MIN_COUNT = 2
export const SIMILAR_EVENT_WINDOW_DAYS = 60

/** Points per shared signal; tune these after measuring clicks. */
export const SIMILARITY_WEIGHTS = {
  eventType: 5,
  taxonomyGroup: 3,
  organizer: 3,
  room: 1,
  free: 1,
  withinWeek: 2,
  withinThreeWeeks: 1,
} as const

/** Candidates must score above this, or they only fill open slots. */
const STRONG_MATCH_SCORE = 3

type ScoredCandidate = {
  event: PublicEvent
  score: number
  nextDate: string
}

/**
 * Upcoming events most like `event`, best first. Siblings in the same series
 * never show, festival siblings take at most one slot, and each organizer
 * group appears at most once.
 */
export function rankSimilarEvents(
  event: PublicEvent,
  candidates: readonly PublicEvent[],
  today: string,
): PublicEvent[] {
  if (event.eventKind === "festivalParent") return []

  const until = addDays(today, SIMILAR_EVENT_WINDOW_DAYS)
  const ownSeriesId =
    event.eventKind === "seriesParent"
      ? event._id
      : event.eventKind === "seriesInstance"
        ? (event.parentEvent?._id ?? null)
        : null

  const scored = candidates.flatMap((candidate): ScoredCandidate[] => {
    if (candidate._id === event._id) return []
    if (ownSeriesId && candidate.parentEvent?._id === ownSeriesId) return []
    if (candidate.eventStatus !== "scheduled" || candidate.isSoldOut) return []
    const nextDate = nextDateOf(candidate, today)
    if (!nextDate || nextDate > until) return []
    return [
      {
        event: candidate,
        score: similarityScore(event, candidate, nextDate, today),
        nextDate,
      },
    ]
  })

  const strong = scored
    .filter(candidate => candidate.score > STRONG_MATCH_SCORE)
    .sort(
      (left, right) =>
        right.score - left.score || left.nextDate.localeCompare(right.nextDate),
    )
  const taxonomyGroupId = event.eventType?.taxonomyGroup?._id
  const fill = taxonomyGroupId
    ? scored
        .filter(
          candidate =>
            candidate.score <= STRONG_MATCH_SCORE &&
            candidate.event.eventType?.taxonomyGroup?._id === taxonomyGroupId,
        )
        .sort((left, right) => left.nextDate.localeCompare(right.nextDate))
    : []

  const picked: PublicEvent[] = []
  const seenParents = new Set<string>()
  const seenOrganizers = new Set<string>()
  for (const { event: candidate } of [...strong, ...fill]) {
    if (picked.length === SIMILAR_EVENT_COUNT) break
    const parentId = candidate.parentEvent?._id
    const organizerId = candidate.organizerGroup?._id
    if (parentId && seenParents.has(parentId)) continue
    if (organizerId && seenOrganizers.has(organizerId)) continue
    if (parentId) seenParents.add(parentId)
    if (organizerId) seenOrganizers.add(organizerId)
    picked.push(candidate)
  }
  return picked.length >= SIMILAR_EVENT_MIN_COUNT ? picked : []
}

export function similarityScore(
  event: PublicEvent,
  candidate: PublicEvent,
  candidateNextDate: string,
  today: string,
): number {
  const weights = SIMILARITY_WEIGHTS
  let score = 0
  if (event.eventType && candidate.eventType?._id === event.eventType._id) {
    score += weights.eventType
  }
  const taxonomyGroupId = event.eventType?.taxonomyGroup?._id
  if (
    taxonomyGroupId &&
    candidate.eventType?.taxonomyGroup?._id === taxonomyGroupId
  ) {
    score += weights.taxonomyGroup
  }
  const organizerIds = new Set(organizerGroupsOf(event).map(group => group._id))
  if (organizerGroupsOf(candidate).some(group => organizerIds.has(group._id))) {
    score += weights.organizer
  }
  if (event.room && candidate.room?._id === event.room._id) {
    score += weights.room
  }
  if (event.isFree && candidate.isFree) score += weights.free
  const days = daysBetween(today, candidateNextDate)
  if (days <= 7) score += weights.withinWeek
  else if (days <= 21) score += weights.withinThreeWeeks
  return score
}

function nextDateOf(event: PublicEvent, today: string): string | null {
  let next: string | null = null
  for (const date of event.dates) {
    if (date.startDate >= today && (next === null || date.startDate < next)) {
      next = date.startDate
    }
  }
  return next
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  )
}
