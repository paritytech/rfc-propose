import { SubmittableExtrinsic } from "@polkadot/api/promise/types";
import { blake2AsHex } from "@polkadot/util-crypto";

import { RequestResult, RequestState } from "./types";

/**
 * blake2-256 hash of the raw proposal text, as described in the [RFC process](https://github.com/polkadot-fellows/RFCs#process).
 * @returns The hash without a "0x" prefix.
 */
export const hashProposal = (proposal: string): string => {
  const result = blake2AsHex(proposal, 256);
  return result.startsWith("0x") ? result.slice(2) : result;
};

export const byteSize = (extrinsic: SubmittableExtrinsic): number =>
  extrinsic.method.toU8a().length * Uint8Array.BYTES_PER_ELEMENT;

/**
 * Extracts commit hash from GitHub's raw url.
 */
export const extractCommitHash = (rawUrl: string): string => {
  const match = rawUrl.match("raw/(.*)/text")?.[1];
  if (match === undefined) throw new Error("Could not extract commit hash.");
  return match;
};

/**
 * Constructs a message to the user when the PR is detected to be not adhering to the process,
 * for example - incorrectly named markdown file with the text of the proposal.
 */
export const userProcessError = (requestState: RequestState, message: string): RequestResult & { success: false } =>
  ({
    success: false,
    errorMessage: `@${requestState.requester} ${message} Please double check the [Process](https://github.com/polkadot-fellows/RFCs#process).`,
  }) as const;
