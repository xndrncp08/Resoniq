import { expect, test } from "@playwright/test";
import { deleteAccount, signUp } from "./account";

test("a project shows its progress, and members move it along", async ({ page }) => {
  await signUp(page, "proj");
  try {
    const { riff } = await (await page.request.post("/api/riffs", { data: { title: "Midnight Static" } })).json();
    const { projectId } = await (await page.request.post(`/api/riffs/${riff.id}/project`)).json();
    await page.goto("/projects");
    const card = page.getByRole("link", { name: /Midnight Static/ });
    await expect(card).toContainText("Ideas");
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/messages/${projectId}`));
    const progress = page.getByRole("list", { name: "Project progress" });
    await progress.getByRole("button", { name: "Recording", exact: true }).click();
    await expect(progress.getByRole("button", { name: "Recording", exact: true })).toHaveAttribute("aria-current", "step");
    await expect(page.getByText("moved the project to Recording.")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Mark finished" }).click();
    await page.goto("/projects");
    await expect(page.getByRole("region", { name: "Finished" }).getByText("Midnight Static")).toBeVisible();
  } finally {
    await deleteAccount(page);
  }
});
