import { getAllRFCRemarks } from "./cron";

describe("RFC Listing test", () => {
  test("Should not return any remark with future date", async () => {
    const { ongoing } = await getAllRFCRemarks(new Date());
    expect(ongoing).toHaveLength(0);
  }, 60_000);
});
