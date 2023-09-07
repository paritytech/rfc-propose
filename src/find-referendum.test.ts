import fs from "fs";

import { findReferendum } from "./find-referendum";
import { getApproveRemarkText, getRejectRemarkText } from "./parse-RFC";

describe("findReferendum", () => {
  test("Finds the 0014 referendum with a lookup", async () => {
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

  test.skip("Finds the (inlined) 0014 referendum", async () => {
    /**
     * This is a semi-manual test.
     * It requires you to run a local Kusama node, create a referendum and wait for it to be confirmed.
     * Use the following for the inlined remark:
     * 0x000049015246435f415050524f564528303031342c6261383431386663343664323531616366646433393630346335666536656133643639656434363465643431313364353065383265613163373132613434666329
     *
     * It could be made more automatic similarly to the setup in the tip bot:
     * https://github.com/paritytech/substrate-tip-bot/blob/master/README.md#end-to-end-tests
     *
     * However, once a first inlined RFC referendum ends up on-chain we could use that for testing.
     * (because these tests are read-only).
     */

    // The blockhash where the referendum with inlined proposal got confirmed.
    const blockHash = "0x???";
    const providerUrl = "ws://localhost:9944";

    const rfcNumber = "0014";
    const text = fs.readFileSync("src/examples/0014-improve-locking-mechanism-for-parachains.md").toString();
    const result = await findReferendum({
      providerUrl,
      blockHash,
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
