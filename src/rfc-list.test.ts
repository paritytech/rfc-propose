import { cron, getAllPRs } from "./rfc-cron";

describe("RFC Listing test", () => {
  test("Cron job", async () => {
    const cronResult = await cron();
    console.log(cronResult);
  }, 60_000);

  test.only("Get PRs", async () => {
    const prs = await getAllPRs();
    console.log(prs);
  }, 60_000);
});
