---
name: convert-event-to-festival
description: Convert an existing arrangement into a festival parent and add the host's own concerts as festival sessions with their own image, description, links and room. Use when an external festival, such as Vill Vill Vest or BIFF, should appear as one festival with Kvarteret's events under it.
---

# Convert an event to a festival

A festival is an `arrangement` with `eventKind: "festivalParent"`. Each concrete
event is an `arrangement` with `eventKind: "festivalSession"` and a strong
`parentEvent` reference to the parent. The model is in
`docs/adr/005-materialized-event-instances-and-festival-event-graphs.md`; the
fields are in `apps/studio/src/studio/schemaTypes/documents/arrangement.ts`.

## 1. Find the original before creating anything

Festival organizers usually have already submitted a single event. Convert that
one in place so its image, description, links and slug are preserved. Never
create a second parent next to it.

Titles live in `localizedTitle`, not `title`, so search the localized array:

    *[_type == "arrangement" && count(localizedTitle[lower(value) match "*name*"]) > 0]

Check drafts and near-duplicates too (a second event with swapped day and
month in its dates is common). Report duplicates you did not touch instead of
deleting them.

## 2. Convert the parent in place

Patch the original document:

- set `eventKind: "festivalParent"`;
- unset `dates`: a parent derives its dates from its sessions and the field is
  hidden in Studio;
- leave `image`, `localizedDescription`, `ticketUrl`, `facebookUrl`, prices and
  organizer as they are. Sessions inherit ticket and price fields, so a price
  on the parent shows on every session.

Promote it only when asked: `isPromoted: true`, `promotedPlacement: "top"`,
`promotedOrder: 0`. Promotion is never inherited by sessions.

Sessions need a published parent, because the reference is strong. Publish the
parent first.

## 3. Add only the host's sessions

Use the festival's own schedule and include only events at the host's venues.
For Kvarteret that is the stage named after Kvarteret or Teglverket; check the
festival's venues page for its stage names. Each session:

- `eventKind: "festivalSession"`, `eventStatus: "scheduled"`,
  `approvalStatus: "approved"`, `isPromoted: false`;
- `parentEvent` pointing at the converted parent;
- exactly one `dates` entry (`startDate`, `startTime`, optional `endTime`);
- `room` referencing the room document, for example `room-teglverket`;
- `localizedTitle` in `nb` and `en`;
- its own `image` with `useFestivalImage: false`; leave `useFestivalImage` on
  only when the source has no real image (a file named "placeholder" is not one);
- `localizedDescription` in `nb` and `en`, built from the source page: use the
  source's own English text instead of translating, then members or line-up,
  genre, and every link it publishes (Spotify, Instagram, the act page);
- a stable, readable `_id` such as `<festival>-<year>-<act>` without periods.

Take the image and text from each act's page on the festival site. Check that a
link belongs to the act (copied pages sometimes carry another act's links) and
leave it out when unsure.

Upload images with the asset tools and reference them by asset id. Uploads can
be rate limited; retry the failed ones.

## 4. Publish and verify

Edits land in drafts. Publish the parent and then the sessions. Afterwards
query to confirm:

- exactly one `festivalParent` carries the festival's name, and nothing
  references a removed duplicate;
- every session resolves `parentEvent` to that parent and has a date and room;
- the parent has no `dates` and keeps its original image and description.

Delete a duplicate parent only after no document references it: unpublish it,
then discard its draft.

## Known site behavior

The calendar and listing build occurrences from every event, so a festival
appears once per day it has sessions in addition to the sessions themselves.
BIFF and Velkomstuken behave the same way. Treat any change to this as a site
code change, not a content change.
