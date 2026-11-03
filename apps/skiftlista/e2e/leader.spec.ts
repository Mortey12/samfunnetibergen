import AxeBuilder from "@axe-core/playwright"
import { expect, type Locator, type Page, test } from "@playwright/test"

// The fake server's first week (Stjerne, uke 49) is seeded the same way on
// every load: Monday to Wednesday half planned, Kari B. on a Wednesday place
// she answered "kan ikke" for, Sara H. "kan ikke i dag" on Monday.

const status = (page: Page) =>
  page.getByRole("status").filter({ hasText: /\S/ }).first()
const people = (page: Page) => page.getByRole("list", { name: "Personer" })
const person = (page: Page, name: string) =>
  people(page).getByRole("button").filter({ hasText: name })
const places = (page: Page) => page.locator("[data-slot]")
const place = (page: Page, label: RegExp) =>
  page.locator("[data-slot]").and(page.getByRole("button", { name: label }))

async function slotOf(locator: Locator): Promise<string> {
  const slot = await locator.getAttribute("data-slot")
  if (!slot) throw new Error("place has no data-slot")
  return slot
}

test.beforeEach(async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Uke 49" })).toBeVisible()
})

test("shows the week, the bar tabs and the chips", async ({ page }) => {
  await expect(
    page
      .getByRole("navigation", { name: "Barer" })
      .getByRole("button", { name: "Stjerne" }),
  ).toHaveAttribute("aria-current", "page")
  await expect(page.getByRole("button", { name: "! 1 problem" })).toBeVisible()
  await expect(page.getByText("Har svart")).toContainText("13")
  await expect(page.getByRole("table")).toBeVisible()
})

test("person first: select, place, focus returns, Ctrl+Z undoes", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Uten skift", exact: true }).click()
  const emil = person(page, "Emil T.")
  await emil.click()
  await expect(emil).toHaveAttribute("aria-pressed", "true")

  const offer = places(page).filter({ hasText: "Sett inn Emil" }).first()
  const slot = await slotOf(offer)
  await offer.click()
  await expect(status(page)).toContainText("Emil T. er satt opp som")
  await expect(page.locator(`[data-slot="${slot}"]`)).toBeFocused()

  await page.keyboard.press("Control+z")
  await expect(status(page)).toContainText("Emil T. er tatt av")
  await expect(page.locator(`[data-slot="${slot}"]`)).toContainText(
    "Sett inn Emil",
  )
})

test("person first: a place that does not fit says why", async ({ page }) => {
  await person(page, "Emil T.").click()
  await expect(
    places(page).filter({ hasText: "bare godkjente skiftledere" }).first(),
  ).toBeVisible()
})

test("place first: the panel lists only people who fit", async ({ page }) => {
  const slPlace = place(page, /^Skiftleder torsdag 3\. desember, Dagskift/)
  await slPlace.click()
  const heading = page.getByRole("heading", {
    name: "Skiftleder, torsdag 3. desember",
  })
  await expect(heading).toBeFocused()
  const panel = page.locator("#place-panel")
  const candidates = panel.getByRole("listitem").getByRole("button")
  const count = await candidates.count()
  expect(count).toBeGreaterThan(0)
  for (let index = 0; index < count; index++) {
    await expect(candidates.nth(index)).toContainText("· SL")
  }
  await candidates.first().click()
  await expect(status(page)).toContainText("er satt opp som skiftleder")
  await expect(panel).toHaveCount(0)
})

test("Escape closes the panel and returns focus to the place", async ({
  page,
}) => {
  const target = place(page, /^Skjenker torsdag 3\. desember, Dagskift/)
  const slot = await slotOf(target)
  await target.click()
  await expect(page.locator("#place-panel")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator("#place-panel")).toHaveCount(0)
  await expect(page.locator(`[data-slot="${slot}"]`)).toBeFocused()
})

test("move to an empty place, then undo", async ({ page }) => {
  const from = place(
    page,
    /^Skjenker tirsdag 1\. desember, Dagskift. Ingrid V\./,
  )
  const fromSlot = await slotOf(from)
  await from.click()
  await page.getByRole("button", { name: "Flytt eller bytt" }).click()
  await expect(page.getByText("Velg en ledig plass å flytte til")).toBeVisible()
  const to = places(page).filter({ hasText: "Flytt hit" }).first()
  await to.click()
  await expect(status(page)).toContainText("Ingrid V. er flyttet til")
  await page.keyboard.press("Control+z")
  await expect(page.locator(`[data-slot="${fromSlot}"]`)).toContainText(
    "Ingrid V.",
  )
})

test("swap two placed skiftledere", async ({ page }) => {
  const a = place(page, /^Skiftleder mandag 30\. november, Dagskift. Even M\./)
  await a.click()
  await page.getByRole("button", { name: "Flytt eller bytt" }).click()
  await place(page, /^Skiftleder tirsdag 1\. desember, Dagskift/).click()
  await expect(status(page)).toContainText("har byttet plass")
  await expect(
    place(page, /^Skiftleder tirsdag 1\. desember, Dagskift. Even M\./),
  ).toBeVisible()
})

test("remove a person from the panel", async ({ page }) => {
  await place(page, /^Skjenker onsdag 2\. desember, Dagskift. Kari B\./).click()
  await page.getByRole("button", { name: "Fjern Kari B." }).click()
  await expect(status(page)).toContainText("Kari B. er tatt av")
  await expect(page.getByRole("button", { name: "! 1 problem" })).toHaveCount(0)
})

test("drag a person onto an empty place", async ({ page }) => {
  await page.getByRole("button", { name: "Uten skift", exact: true }).click()
  const target = place(
    page,
    /^Skjenker torsdag 3\. desember, Kveldsskift/,
  ).first()
  await person(page, "Emil T.").dragTo(target)
  await expect(status(page)).toContainText("Emil T. er satt opp som")
})

test("publish, then a change marks the week as changed", async ({ page }) => {
  await page.getByRole("button", { name: "Publiser uka" }).click()
  await expect(page.getByText("Publisert", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Gjør til utkast" }),
  ).toBeVisible()
  await person(page, "Emil T.").click()
  await places(page).filter({ hasText: "Sett inn Emil" }).first().click()
  await expect(
    page.getByText("Endret etter publisering", { exact: true }),
  ).toBeVisible()
})

test("search and filters narrow the people list", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Søk etter navn" }).fill("ada")
  await expect(people(page).getByRole("button")).toHaveCount(1)
  await page.getByRole("searchbox", { name: "Søk etter navn" }).fill("")
  await page.getByRole("button", { name: "Skiftledere" }).click()
  await expect(people(page).getByRole("button")).toHaveCount(5)
  await expect(page.getByText("Viser 5 av 16")).toBeVisible()
})

test("a day header sorts people by that day's answers", async ({ page }) => {
  const monday = page.getByRole("button", { name: /^Mandag 30\. november/ })
  await monday.click()
  await expect(monday).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByText("Sortert etter svar for")).toContainText(
    "mandag 30. november",
  )
  await page.getByRole("button", { name: "Fjern dag" }).click()
  await expect(monday).toHaveAttribute("aria-pressed", "false")
})

test("switch bar and week", async ({ page }) => {
  await page
    .getByRole("navigation", { name: "Barer" })
    .getByRole("button", { name: "Grøndahls" })
    .click()
  await expect(page.getByRole("rowheader", { name: /Pub/ })).toBeVisible()
  await expect(
    place(page, /^Skiftleder lørdag 5\. desember, Pub/),
  ).toBeVisible()
  await page.getByRole("button", { name: "Neste uke" }).click()
  await expect(page.getByRole("heading", { name: "Uke 50" })).toBeVisible()
  await page.getByRole("button", { name: /^Uke 49,/ }).click()
  await expect(page.getByRole("heading", { name: "Uke 49" })).toBeVisible()
})

test("keyboard only: select with Enter and place with Enter", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Uten skift", exact: true }).focus()
  await page.keyboard.press("Enter")
  await person(page, "Emil T.").focus()
  await page.keyboard.press("Enter")
  const offer = places(page).filter({ hasText: "Sett inn Emil" }).first()
  await offer.focus()
  await page.keyboard.press("Enter")
  await expect(status(page)).toContainText("Emil T. er satt opp som")
})

test("no automatic accessibility violations (axe, WCAG 2.1 AA)", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  expect(results.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([])
})

test("narrow screen: the page itself never scrolls sideways", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 })
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test("someone who cannot come today: the place shows who and needs a replacement", async ({
  page,
}) => {
  const sickPlace = place(
    page,
    /^Skjenker mandag 30\. november, Dagskift. Sara H\./,
  )
  await expect(sickPlace).toContainText("Kan ikke i dag, trenger erstatter")
  await sickPlace.click()
  await expect(page.locator("#place-panel")).toContainText(
    "Sara H. har meldt kan ikke i dag",
  )
  await page
    .locator("#place-panel")
    .getByRole("listitem")
    .getByRole("button")
    .first()
    .click()
  await expect(status(page)).toContainText("er satt opp som skjenker")
  await expect(
    page.locator(`[data-slot]`).filter({ hasText: "trenger erstatter" }),
  ).toHaveCount(0)
})

test("print: the whole week fits on a landscape page", async ({ page }) => {
  // A4 landscape minus 10 mm margins is about 277 mm, or 1047 CSS pixels.
  await page.setViewportSize({ width: 1047, height: 740 })
  await page.emulateMedia({ media: "print" })
  const sunday = page.getByRole("columnheader", { name: /Søndag/ })
  const box = await sunday.boundingBox()
  expect(box).not.toBeNull()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(1047)
  await expect(page.locator("#people-panel")).toBeHidden()
  await expect(page.getByRole("button", { name: "Publiser uka" })).toBeHidden()
})
