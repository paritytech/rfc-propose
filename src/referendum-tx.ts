import { ApiPromise, WsProvider } from "@polkadot/api";

import { POLKADOT_APPS_URL, PROVIDER_URL } from "./constants";
import { byteSize } from "./util";

const polkadotAppsDecodeURL = (transactionHex: string) => `${POLKADOT_APPS_URL}extrinsics/decode/${transactionHex}`;

export const createReferendumTx = async (opts: {
  remarkText: string;
}): Promise<{ transactionHex: string; transactionCreationUrl: string; remarkText: string }> => {
  const api = new ApiPromise({ provider: new WsProvider(PROVIDER_URL) });
  await api.isReadyOrError;

  const { remarkText } = opts;
  const remarkTx = api.tx.system.remark(remarkText);

  if (byteSize(remarkTx) >= 128) {
    // https://github.com/paritytech/substrate/blob/ae5085782b2981f35338ff6d4e5417e74c569377/frame/support/src/traits/preimages.rs#L27
    throw new Error("Inlining proposal is limited to 128 bytes.");
  }

  const submitTx = api.tx.fellowshipReferenda.submit(
    { FellowshipOrigins: "Fellows" },
    { Inline: remarkTx.method.toHex() },
    { After: 0 },
  );

  const transactionHex: string = submitTx.method.toHex();

  await api.disconnect();
  return { transactionHex, transactionCreationUrl: polkadotAppsDecodeURL(transactionHex), remarkText };
};
