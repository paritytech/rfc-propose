import { ApiPromise, WsProvider } from "@polkadot/api";
import type { SubmittableExtrinsic } from "@polkadot/api/promise/types";

import { PROVIDER_URL } from "./constants";
import { ParseRFCResult } from "./parse-RFC";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

/**
 * @returns Find the state of a referendum concerning this RFC.
 * The returned RFC referendum state can be one of:
 * - approved (and executed) - meaning the referendum approving this RFC has passed and has been executed,
 * - rejected (and executed) - meaning the referendum rejecting this RFC has passed and has been executed,
 * - null, meaning that the referendum in a proper state with a proper remark has not been found. It's possible there is a referendum approving or rejecting this RFC but has not passed and not been executed yet.
 */
export const findReferendumState = async (opts: {
  parseRFCResult: ParseRFCResult;
  blockHash: string;
  providerUrl?: string | undefined;
}): Promise<null | "approved" | "rejected"> => {
  const api = new ApiPromise({ provider: new WsProvider(opts.providerUrl ?? PROVIDER_URL) });
  await api.isReadyOrError;

  const apiAt = await api.at(opts.blockHash);
  // The `referendumInfoFor()` function exposes more data at blocks before the referendum got approved.
  const apiAtPrev = await api.at((await api.rpc.chain.getHeader(opts.blockHash)).parentHash);

  const events = (await apiAt.query.system.events()) as unknown as any[];
  for (const event of events) {
    if (event.event.section === "fellowshipReferenda" && event.event.method === "Confirmed") {
      const [referendumIndex] = event.event.data;
      const info = (await apiAtPrev.query.fellowshipReferenda.referendumInfoFor(referendumIndex)).toJSON() as Record<
        string,
        any
      >;

      /**
       * Checks if the given transaction (expected remark),
       * matches what is found in the on-chain referendum we currently iterate over.
       */
      const remarkMatchesProposal = (tx: SubmittableExtrinsic): boolean =>
        info?.ongoing?.proposal?.lookup?.hash === tx.method.hash.toHex() ||
        info?.ongoing?.proposal?.inline === tx.method.toHex();

      if (remarkMatchesProposal(api.tx.system.remark(opts.parseRFCResult.approveRemarkText))) {
        await api.disconnect();
        return "approved";
      }
      if (remarkMatchesProposal(api.tx.system.remark(opts.parseRFCResult.rejectRemarkText))) {
        await api.disconnect();
        return "rejected";
      }
    }
  }

  await api.disconnect();

  return null;
};
