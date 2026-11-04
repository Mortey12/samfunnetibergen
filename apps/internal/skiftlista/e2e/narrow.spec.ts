import AxeBuilder from "@axe-core/playwright"
import { expect, type Page, test } from "@playwright/test"

// Phone-sized window (see the "phone" project in playwright.config.ts): below
// 80rem the place panel opens in a sheet (a dialog) instead of beside the grid.

const status = (page: Page) =>
  page.getByRole("status").filter({ hasText: /\S/ }).first()
const thursdayLeader = (page: Page) =>
  page.locator("[data-slot]").and(
    page.getByRole("button", {
      name: /^Skiftleder torsdag 3\. desember, Dagskift/,
    }),
  )

const dayStrip = (page: Page) =>
  page.getByRole("navigation", { name: "Velg dag" })

test.beforeEach(async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Uke 49" })).toBeVisible()
  // The grid shows one day at a time on a phone; most tests work on Thursday.
  await dayStrip(page)
    .getByRole("button", { name: /^Torsdag/ })
    .click()
})

test("a place opens in a sheet with focus on its heading", async ({ page }) => {
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await thursdayLeader(page).click()
  const sheet = page.getByRole("dialog", {
    name: "Skiftleder, torsdag 3. desember",
  })
  await expect(sheet).toBeVisible()
  await expect(
    sheet.getByRole("heading", { name: "Skiftleder, torsdag 3. desember" }),
  ).toBeFocused()
  await expect(
    sheet.getByRole("button", { name: "Lukk plassen" }),
  ).toBeVisible()
  // The sheet is the one place panel; nothing is rendered twice.
  await expect(page.locator("#place-panel")).toHaveCount(1)
})

test("Escape closes the sheet and focus returns to the place", async ({
  page,
}) => {
  const target = thursdayLeader(page)
  await target.click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(target).toBeFocused()
})

test("the close button closes the sheet", async ({ page }) => {
  const target = thursdayLeader(page)
  await target.click()
  await page.getByRole("button", { name: "Lukk plassen" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(target).toBeFocused()
})

test("choosing a person places them and closes the sheet", async ({ page }) => {
  await thursdayLeader(page).click()
  await page
    .getByRole("dialog")
    .getByRole("listitem")
    .getByRole("button")
    .first()
    .click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(status(page)).toContainText("er satt opp som skiftleder")
  await expect(thursdayLeader(page)).not.toContainText("Ledig")
})

test("Flytt eller bytt closes the sheet so a target can be clicked", async ({
  page,
}) => {
  await dayStrip(page)
    .getByRole("button", { name: /^Tirsdag/ })
    .click()
  await page
    .locator("[data-slot]")
    .and(page.getByRole("button", { name: /^\w+ tirsdag.*Ingrid V\./ }))
    .click()
  await page.getByRole("button", { name: "Flytt eller bytt" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.getByText("Velg en ledig plass å flytte til")).toBeVisible()
})

test("a person can be moved to another day by switching day while moving", async ({
  page,
}) => {
  await dayStrip(page)
    .getByRole("button", { name: /^Tirsdag/ })
    .click()
  await page
    .locator("[data-slot]")
    .and(page.getByRole("button", { name: /^\w+ tirsdag.*Ingrid V\./ }))
    .click()
  await page.getByRole("button", { name: "Flytt eller bytt" }).click()
  // Still moving after the day is switched.
  await dayStrip(page)
    .getByRole("button", { name: /^Torsdag/ })
    .click()
  await expect(page.getByText("Velg en ledig plass å flytte til")).toBeVisible()
  await page
    .locator("[data-slot]")
    .and(page.getByRole("button", { name: /^Skjenker torsdag.*Flytt hit/ }))
    .first()
    .click()
  await expect(status(page)).toContainText("Ingrid")
  await expect(
    page.getByRole("button", { name: /^Skjenker torsdag.*Ingrid V\./ }),
  ).toBeVisible()
})

test("the sheet has no automatic accessibility violations and no sideways scroll", async ({
  page,
}) => {
  await thursdayLeader(page).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  expect(results.violations.map(v => `${v.id}: ${v.nodes.length}`)).toEqual([])
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test("growing the window to a laptop moves the panel beside the grid", async ({
  page,
}) => {
  await thursdayLeader(page).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.setViewportSize({ width: 1366, height: 860 })
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(page.locator("#place-panel")).toBeVisible()
})

test("a click on the dimmed page behind the sheet closes it", async ({
  page,
}) => {
  await thursdayLeader(page).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.mouse.click(10, 10)
  await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("Tab stays inside the open sheet", async ({ page }) => {
  await thursdayLeader(page).click()
  const sheet = page.getByRole("dialog")
  await expect(sheet).toBeVisible()
  for (let press = 0; press < 40; press++) {
    await page.keyboard.press("Tab")
    const inside = await page.evaluate(() =>
      Boolean(document.activeElement?.closest("[data-slot='sheet']")),
    )
    expect(inside).toBe(true)
  }
})

test("plus and minus stay inside their day column", async ({ page }) => {
  // A day column is about 100 px wide here. The buttons used to spill out of
  // it and were cut off; they now wrap under the label.
  const buttons = page.locator("[data-plus]:visible, [data-minus]:visible")
  expect(await buttons.count()).toBeGreaterThan(1)
  const outside = await buttons.evaluateAll(
    list =>
      list.filter(button => {
        const cell = button.closest("td")?.getBoundingClientRect()
        const box = button.getBoundingClientRect()
        return !cell || box.left < cell.left || box.right > cell.right
      }).length,
  )
  expect(outside).toBe(0)
})

test("the grid shows one day at a time and the strip changes the day", async ({
  page,
}) => {
  const strip = dayStrip(page)
  await expect(strip.getByRole("button", { name: /^Torsdag/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  )
  // Thursday's places are on screen, Monday's are not (and are not reachable).
  await expect(
    page
      .getByRole("button", { name: /^Skiftleder torsdag 3\. desember/ })
      .first(),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /^Skiftleder mandag 30\. november/ }),
  ).toHaveCount(0)

  await strip.getByRole("button", { name: /^Mandag/ }).click()
  await expect(
    page
      .getByRole("button", { name: /^Skiftleder mandag 30\. november/ })
      .first(),
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: /^Skiftleder torsdag 3\. desember/ }),
  ).toHaveCount(0)
  // The page itself never scrolls sideways, and the grid does not need to.
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    window: window.innerWidth,
    grid: (() => {
      const grid = document.querySelector(".week-grid") as HTMLElement
      return [grid.scrollWidth, grid.clientWidth]
    })(),
  }))
  expect(widths.page).toBeLessThanOrEqual(widths.window)
  expect(widths.grid[0]).toBeLessThanOrEqual(widths.grid[1])
})

test("a laptop shows every day and no day strip", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await expect(dayStrip(page)).toBeHidden()
  await expect(
    page
      .getByRole("button", { name: /^Skiftleder mandag 30\. november/ })
      .first(),
  ).toBeVisible()
  await expect(
    page
      .getByRole("button", { name: /^Skiftleder torsdag 3\. desember/ })
      .first(),
  ).toBeVisible()
})
