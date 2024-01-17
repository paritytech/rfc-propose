import { getAllRFCRemarks } from "./cron";

describe("RFC Listing test", () => {
  test("Should not return any remark with future date", async () => {
    const remarks = await getAllRFCRemarks(new Date());
    expect(remarks).toHaveLength(0);
  }, 60_000);
});
