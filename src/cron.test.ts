import { getAllRFCRemarks } from "./cron";

const TIMEOUT = 180_000;

describe("RFC Listing test", () => {
  test(
    "Should not return any remark with future date",
    async () => {
      const { ongoing, completed } = await getAllRFCRemarks(new Date());
      expect(ongoing).toHaveLength(0);
      expect(completed).toHaveLength(0);
    },
    TIMEOUT,
  );

  test.only(
    "Should return completed projects in the past",
    async () => {
      // It feels wrong to call 2000 an 'old date'
      const oldDate = new Date("01/01/2000");
      const { completed } = await getAllRFCRemarks(oldDate);
      expect(completed.length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});
