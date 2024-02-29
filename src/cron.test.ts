import { getAllRFCRemarks } from "./cron";

describe("RFC Listing test", () => {
  test("Should not return any remark with future date", async () => {
    const { ongoing, completed } = await getAllRFCRemarks(new Date());
    expect(ongoing).toHaveLength(0);
    expect(completed).toHaveLength(0);
  }, 90_000);

  test("Should return completed projects in the past", async () => {
    // It feels wrong to call 2000 an 'old date'
    const oldDate = new Date("01/01/2000");
    const { completed } = await getAllRFCRemarks(oldDate);
    expect(completed.length).toBeGreaterThan(0);
  }, 90_000);
});
