import { test, expect, type Page } from "@playwright/test";
import referenceDeck from "../../shared/game/referenceDeck1648.json";

/**
 * A fixed run through the reference deck, computed with shared/game/engine.ts:
 * all twelve cards are played, "Battle of Pyliavtsi" fades on the fifth card,
 * three traces are answered correctly (rung: influential) and the year ends
 * with final Stability in the "shifted" band.
 */
const CHOICES = ["right", "right", "left", "left", "right", "left", "left", "left", "left", "right", "right", "left"] as const;
const FADING_CARD_INDEX = 4;
const FADED_TITLE = "Battle of Pyliavtsi";

async function mockDeckAPI(page: Page) {
  await page.route("**/api/game/deck", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "x-deck-source": "reference" },
      body: JSON.stringify(referenceDeck),
    })
  );
}

async function begin(page: Page) {
  await page.goto("/play");
  await page.getByTestId("intro-begin").click();
  await expect(page.getByTestId("card")).toBeVisible();
}

test.describe("Chronicle — /play", () => {
  test.beforeEach(async ({ page }) => {
    await mockDeckAPI(page);
  });

  test("plays a full run with the buttons and reaches the result screen", async ({ page }) => {
    await begin(page);

    for (let index = 0; index < CHOICES.length; index += 1) {
      const side = CHOICES[index];
      const card = referenceDeck.cards[index];
      await expect(page.getByTestId("card")).toHaveAttribute("data-card-id", card.id);
      await expect(page.getByTestId("card")).toContainText(card.speakerName);

      await page.getByTestId(`choice-${side}`).click();

      const consequence = page.getByTestId("consequence");
      await expect(consequence).toContainText(card[side].consequence);

      if (index === FADING_CARD_INDEX) {
        // The fading is shown with the consequence…
        await expect(consequence).toContainText(`The ink is fading: ${FADED_TITLE}`);
        // …and the Chronicle now carries one washed-out entry labelled "uncertain".
        await page.getByTestId("chronicle-open").click();
        const panel = page.getByTestId("chronicle-panel");
        await expect(panel).toBeVisible();
        await expect(panel.getByTestId("chronicle-entry")).toHaveCount(referenceDeck.chronicle.length);
        const faded = panel.locator('[data-testid="chronicle-entry"][data-state="faded"]');
        await expect(faded).toHaveCount(1);
        await expect(faded).toContainText(FADED_TITLE);
        await expect(faded).toContainText("uncertain");
        await page.keyboard.press("Escape");
        await expect(panel).toBeHidden();
      }

      // A tap skips the pause instead of waiting it out.
      await consequence.click();
    }

    await expect(page.getByTestId("result")).toBeVisible();
    await expect(page.getByTestId("rung-title")).toHaveText("A person of influence");
    await expect(page.getByTestId("world-fate")).toHaveAttribute("data-fate", "shifted");
    await expect(page.getByTestId("world-fate")).not.toBeEmpty();
    await expect(page.getByTestId("result")).toContainText(FADED_TITLE);

    // "Play again" restarts the same deck from its first card.
    await page.getByTestId("play-again").click();
    await expect(page.getByTestId("card")).toHaveAttribute("data-card-id", referenceDeck.cards[0].id);
  });

  test("keyboard arrows answer a card and move on to the next one", async ({ page }) => {
    await begin(page);
    const [first, second] = referenceDeck.cards;
    await expect(page.getByTestId("card")).toHaveAttribute("data-card-id", first.id);

    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("consequence")).toContainText(first.right.consequence);

    // Any key dismisses the consequence.
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("card")).toHaveAttribute("data-card-id", second.id);

    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("consequence")).toContainText(second.left.consequence);
  });

  test("falls back to the bundled deck when the deck API fails", async ({ page }) => {
    await page.route("**/api/game/deck", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "down" }) })
    );
    await begin(page);
    await expect(page.getByTestId("card")).toHaveAttribute("data-card-id", referenceDeck.cards[0].id);
  });
});
