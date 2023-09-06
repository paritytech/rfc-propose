import fs from "fs";

import { findReferendum } from "./find-referendum";
import { getApproveRemarkText, getRejectRemarkText } from "./parse-RFC";

describe("findReferendum", () => {
  test("Finds the 0014 referendum", async () => {
    // https://collectives.polkassembly.io/member-referenda/16
    const rfcNumber = "0014";
    const text = fs.readFileSync("src/examples/0014-improve-locking-mechanism-for-parachains.md").toString();
    const result = await findReferendum({
      blockHash: "0x39fbc57d047c71f553aa42824599a7686aea5c9aab4111f6b836d35d3d058162",
      parseRFCResult: {
        rfcNumber,
        rfcFileRawUrl: "",
        approveRemarkText: getApproveRemarkText(rfcNumber, text),
        rejectRemarkText: getRejectRemarkText(rfcNumber, text),
      },
    });

    expect(result && "approved" in result && result.approved).toBeTruthy();
  });
});
