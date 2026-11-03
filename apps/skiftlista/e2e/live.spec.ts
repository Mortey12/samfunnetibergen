import { readFileSync } from "node:fs"
import AxeBuilder from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

// The page in "live" mode (?api=http): it reads from Personal through
// /personal/*. These tests answer those requests with a recorded real response
// (demo data from a local Personal, bar Stjerne, week 45), so they need no
// Personal. Writing is not built yet; the tests check that it says so.

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"),
  )
const ME = fixture("me.json")
const WEEK = fixture("week-stjerne-45.json")

const places = (page: Page) => page.locator("[data-slot]")

async function mockPersonal(page: Page) {
  const asked: string[] = []
  await page.route("**/personal/api/v1/leader/shifts/**", async route => {
    const url = new URL(route.request().url())
    asked.push(url.pathname + url.search)
    if (url.pathname.endsWith("/me")) return route.fulfill({ json: ME })
    // The week asked for in the address, so the page and the address agree.
    const weekStart = url.pathname.split("/").pop()
    return route.fulfill({ json: { ...WEEK, week_start: weekStart } })
  })
  return asked
}

test("opens the week named in the address and keeps bar and week in it", async ({
  page,
}) => {
  const asked = await mockPersonal(page)
  await page.goto("/?api=http&bar=7&uke=2026-11-02")

  await expect(page.getByRole("heading", { name: "Uke 45" })).toBeVisible()
  await expect(
    page
      .getByRole("navigation", { name: "Barer" })
      .getByRole("button", { name: "Stjerne" }),
  ).toHaveAttribute("aria-current", "page")
  await expect(page.getByText("Leser fra Personal")).toBeVisible()
  expect(asked).toContain(
    "/personal/api/v1/leader/shifts/weeks/2026-11-02?group_id=7",
  )
  await expect(page).toHaveURL(/api=http/)
  await expect(page).toHaveURL(/bar=7/)
  await expect(page).toHaveURL(/uke=2026-11-02/)
})

test("next week asks Personal for the next Monday and updates the address", async ({
  page,
}) => {
  const asked = await mockPersonal(page)
  await page.goto("/?api=http&bar=7&uke=2026-11-02")
  await expect(page.getByRole("heading", { name: "Uke 45" })).toBeVisible()
  await page.getByRole("button", { name: "Neste uke" }).click()

  await expect
    .poll(() => asked.some(url => url.includes("2026-11-09")))
    .toBe(true)
  await expect(page).toHaveURL(/uke=2026-11-09/)
})

test("every box has its own id, also when a slot has several seats", async ({
  page,
}) => {
  await mockPersonal(page)
  await page.goto("/?api=http&bar=7&uke=2026-11-02")
  await expect(page.getByRole("heading", { name: "Uke 45" })).toBeVisible()

  const ids = await places(page).evaluateAll(nodes =>
    nodes.map(node => node.getAttribute("data-slot")),
  )
  const expected = WEEK.shifts.flatMap(
    (shift: { places: unknown[] }) => shift.places,
  ).length
  expect(ids.length).toBe(expected)
  expect(new Set(ids).size).toBe(ids.length)
})

test("ledige counts only the places that must be filled", async ({ page }) => {
  await mockPersonal(page)
  await page.goto("/?api=http&bar=7&uke=2026-11-02")
  const needed = WEEK.shifts
    .flatMap((shift: { places: { needed: boolean }[] }) => shift.places)
    .filter((place: { needed: boolean }) => place.needed).length
  // The empty Opplæring places are drawn, but they are not counted.
  expect(needed).toBe(5)
  await expect(
    page.getByRole("button", { name: `${needed} ledige` }),
  ).toBeVisible()
  await expect(
    places(page).filter({ hasText: "Ledig" }).filter({ hasText: "Opplæring" }),
  ).not.toHaveCount(0)
})

test("planned hours come from Personal", async ({ page }) => {
  await mockPersonal(page)
  await page.goto("/?api=http&bar=7&uke=2026-11-02")
  const withHours = WEEK.people.find(
    (person: { week_minutes: number }) => person.week_minutes > 0,
  )
  const hours = Math.floor(withHours.week_minutes / 60)
  await expect(
    page
      .getByRole("list", { name: "Personer" })
      .getByRole("button")
      .filter({ hasText: withHours.name }),
  ).toContainText(`${hours} t`)
})

test("someone without approval can be offered with the red warning and the popup", async ({
  page,
}) => {
  await mockPersonal(page)
  await page.goto("/?api=http&bar=7&uke=2026-11-02")
  await expect(page.getByRole("heading", { name: "Uke 45" })).toBeVisible()
  const nonLeader = WEEK.people.find(
    (person: { is_skiftleder: boolean }) => !person.is_skiftleder,
  )
  await page
    .getByRole("list", { name: "Personer" })
    .getByRole("button")
    .filter({ hasText: nonLeader.name })
    .first()
    .click()
  const offer = places(page)
    .filter({ hasText: "Kun for godkjente skiftledere" })
    .first()
  await expect(offer).toContainText("Krever bekreftelse")
  await offer.click()
  await expect(page.getByRole("alertdialog")).toContainText(
    "Kun for godkjente skiftledere",
  )
})

test("changing the week says that it is not built yet", async ({ page }) => {
  await mockPersonal(page)
  await page.goto("/?api=http&bar=7&uke=2026-11-02")
  await expect(page.getByRole("heading", { name: "Uke 45" })).toBeVisible()
  // The recorded week is published, so the button offers to make it a draft.
  await page.getByRole("button", { name: "Gjør til utkast" }).click()
  await expect(
    page.getByRole("status").filter({ hasText: "ikke bygd ennå" }),
  ).toBeVisible()
})

test("not signed in: a clear message with a link to Personal's login", async ({
  page,
}) => {
  await page.route("**/personal/api/v1/leader/shifts/**", route =>
    route.fulfill({
      status: 401,
      json: { detail: "Authentication required." },
    }),
  )
  await page.goto("/?api=http")

  const alert = page.getByRole("alert")
  await expect(alert).toContainText("Du er ikke logget inn i Personal.")
  await expect(
    alert.getByRole("link", { name: "Logg inn i Personal" }),
  ).toHaveAttribute("href", "/login")
})

test("a failing server shows Personal's own text and Prøv igjen works", async ({
  page,
}) => {
  let failing = true
  await page.route("**/personal/api/v1/leader/shifts/**", route => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/me")) return route.fulfill({ json: ME })
    if (failing)
      return route.fulfill({
        status: 503,
        json: { detail: "Skiftplanen er ikke satt opp ennå." },
      })
    return route.fulfill({ json: WEEK })
  })
  await page.goto("/?api=http&bar=7&uke=2026-11-02")

  await expect(page.getByRole("alert")).toContainText(
    "Skiftplanen er ikke satt opp ennå.",
  )
  failing = false
  await page.getByRole("button", { name: "Prøv igjen" }).click()
  await expect(page.getByRole("heading", { name: "Uke 45" })).toBeVisible()
})

test("no automatic accessibility violations on a real board", async ({
  page,
}) => {
  await mockPersonal(page)
  await page.goto("/?api=http&bar=7&uke=2026-11-02")
  await expect(page.getByRole("heading", { name: "Uke 45" })).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  expect(results.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([])
})
