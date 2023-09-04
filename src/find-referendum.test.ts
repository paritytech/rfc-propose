import { findReferendum } from "./find-referendum";

describe("findReferendum", () => {
  test("Finds the 0005 referendum", async () => {
    // https://collectives.subsquare.io/fellowship/referenda/13
    const result = await findReferendum({
      blockHash: "0x24c6f29be6db3f87bcce2de6b4b73af1a52fe24db5da20e0841b47fa5f471bf7",
      parseRFCResult: {
        rfcNumber: "0005",
        rfcFileRawUrl: "",
        // Typo in the RFC: APPROVE_RFC instead of RFC_APPROVE.
        approveRemarkText: "APPROVE_RFC(0005,9cbabfa80598d2935830c09c18e0a0e4ed8227b8c8f744f1f4a41d8597bb6d44)",
        rejectRemarkText: "REJECT_RFC(0005,9cbabfa80598d2935830c09c18e0a0e4ed8227b8c8f744f1f4a41d8597bb6d44)",
      },
    });

    expect(result && "approved" in result && result.approved).toBeTruthy();
  });
});
