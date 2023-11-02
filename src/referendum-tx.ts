import { HexString, Struct, u8 } from "@polkadot-api/substrate-bindings";
import { toHex } from "@polkadot-api/utils";

import { POLKADOT_APPS_URL } from "./constants";
import {
  _bytesSeq,
  cCollectives_polkadot_runtimeOriginCaller,
  cFrame_supportTraitsPreimagesBounded,
  cFrame_supportTraitsScheduleDispatchTime,
} from "./referendum-tx-codecs";

const polkadotAppsDecodeURL = (transactionHex: string) => `${POLKADOT_APPS_URL}extrinsics/decode/${transactionHex}`;

export const createReferendumTx = (opts: {
  remarkText: string;
}): { transactionHex: string; transactionCreationUrl: string; remarkText: string } => {
  const { remarkText } = opts;

  const textEncoder = new TextEncoder();
  const hexEncodedRemarkText = toHex(textEncoder.encode(remarkText)) as HexString;

  const remarkCall = Struct({
    module: u8,
    method: u8,
    args: Struct({ remark: _bytesSeq }),
  });

  const remarkCallData = remarkCall.enc({
    module: 0,
    method: 0,
    args: {
      remark: hexEncodedRemarkText,
    },
  });

  if (remarkCallData.byteLength >= 128) {
    // https://github.com/paritytech/substrate/blob/ae5085782b2981f35338ff6d4e5417e74c569377/frame/support/src/traits/preimages.rs#L27
    throw new Error("Inlining proposal is limited to 128 bytes.");
  }

  const fellowshipReferendaCall = Struct({
    module: u8,
    method: u8,
    args: Struct({
      proposal_origin: cCollectives_polkadot_runtimeOriginCaller,
      proposal: cFrame_supportTraitsPreimagesBounded,
      enactment_moment: cFrame_supportTraitsScheduleDispatchTime,
    }),
  });

  const fellowshipReferendaCallData = fellowshipReferendaCall.enc({
    module: 61,
    method: 0,
    args: {
      proposal_origin: {
        tag: "FellowshipOrigins",
        value: {
          tag: "Fellows",
          value: undefined,
        },
      },
      proposal: {
        tag: "Inline",
        value: toHex(remarkCallData) as HexString,
      },
      enactment_moment: {
        tag: "After",
        value: 0,
      },
    },
  });

  const transactionHex: string = toHex(fellowshipReferendaCallData);

  return { transactionHex, transactionCreationUrl: polkadotAppsDecodeURL(transactionHex), remarkText };
};
