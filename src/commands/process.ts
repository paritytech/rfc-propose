import * as githubActions from "@actions/github";

import { findReferendum } from "../find-referendum";
import { RequestResult, RequestState } from "../types";
import { userProcessError } from "../util";
import { parseRFC } from "./common/parse-RFC";

export const handleProcessCommand = async (requestState: RequestState, blockHash: string): Promise<RequestResult> => {
  const parseRFCResult = await parseRFC(requestState);
  if ("success" in parseRFCResult) {
    return parseRFCResult;
  }

  const referendum = await findReferendum({ parseRFCResult, blockHash });
  if (!referendum) {
    return userProcessError(requestState, `Unable to find the referendum confirm event in the given block.`);
  }
  if ("approved" in referendum && referendum.approved) {
    await requestState.octokitInstance.rest.pulls.merge({
      owner: githubActions.context.repo.owner,
      repo: githubActions.context.repo.repo,
      pull_number: githubActions.context.issue.number,
    });
    return { success: true, message: "The on-chain referendum has approved the RFC." };
  }
  await requestState.octokitInstance.rest.pulls.update({
    owner: githubActions.context.repo.owner,
    repo: githubActions.context.repo.repo,
    pull_number: githubActions.context.issue.number,
    state: "closed",
  });
  return { success: true, message: "The on-chain referendum has rejected the RFC." };
};
