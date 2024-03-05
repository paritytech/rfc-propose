import { getAllRFCRemarks } from "./cron";

const TIMEOUT = 180_000;

describe("RFC Listing test", () => {
  test(
    "Should not return any remark with future date",
    async () => {
      const { ongoing, finished } = await getAllRFCRemarks(new Date());
      expect(ongoing).toHaveLength(0);
      expect(finished).toHaveLength(0);
    },
    TIMEOUT,
  );

  test(
    "Should return completed projects in the past",
    async () => {
      // It feels wrong to call 2000 an 'old date'
      const oldDate = new Date("01/01/2000");
      const { finished } = await getAllRFCRemarks(oldDate);
      expect(finished.length).toBeGreaterThan(0);
    },
    TIMEOUT,
  );
});
