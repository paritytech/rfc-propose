import { ApiPromise, WsProvider } from "@polkadot/api";

import { PROVIDER_URL } from "./constants";
import { ParseRFCResult } from "./parse-RFC";

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

export const findReferendum = async (opts: {
  parseRFCResult: ParseRFCResult;
  blockHash: string;
}): Promise<null | { approved: boolean }> => {
  const api = new ApiPromise({ provider: new WsProvider(PROVIDER_URL) });
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
      // TODO: Handle inlined proposal as well.
      // https://github.com/paritytech/rfc-action/issues/12
      const proposalHash = info?.ongoing?.proposal?.lookup?.hash;

      if (proposalHash === api.tx.system.remark(opts.parseRFCResult.approveRemarkText).method.hash.toHex()) {
        await api.disconnect();
        return { approved: true };
      }
      if (proposalHash === api.tx.system.remark(opts.parseRFCResult.rejectRemarkText).method.hash.toHex()) {
        await api.disconnect();
        return { approved: false };
      }
    }
  }

  await api.disconnect();

  return null;
};
