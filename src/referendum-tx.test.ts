import * as fs from "fs";

import { getApproveRemarkText } from "./parse-RFC";
import { createReferendumTx } from "./referendum-tx";

describe("createReferendumTx", () => {
  test("Properly constructs the transaction hash and link", async () => {
    // https://raw.githubusercontent.com/xlc/RFCs/d4589ded275b721e33cbeb1e7a27e2f29899cdc3/text/0014-improve-locking-mechanism-for-parachains.md
    const rfcProposalText = fs.readFileSync("src/examples/0014-improve-locking-mechanism-for-parachains.md").toString();

    const rfcNumber = "0014";
    const result = await createReferendumTx({ remarkText: getApproveRemarkText(rfcNumber, rfcProposalText) });

    expect(result.transactionHex).toEqual(
      "0x3d003e02015901000049015246435f415050524f564528303031342c62613834313866633436643235316163666464333936303463356665366561336436396564343634656434313133643530653832656131633731326134346663290100000000",
    );
    console.log(`Link for manual inspection: ${result.transactionCreationUrl}`);
  });
});
