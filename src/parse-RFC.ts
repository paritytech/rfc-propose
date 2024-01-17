import fetch from "node-fetch";

import { OctokitInstance, RequestResultFailed, RequestState } from "./types";
import { hashProposal, userProcessError } from "./util";

export type ParseRFCResult = {
  approveRemarkText: string;
  rejectRemarkText: string;
  rfcNumber: string;
  rfcFileRawUrl: string;
};

export const extractRfcResult = async (
  octokit: OctokitInstance,
  pr: { owner: string; repo: string; number: number },
): Promise<{ success: true; result: ParseRFCResult } | { success: false; error: string }> => {
  const { owner, repo, number } = pr;
  const addedMarkdownFiles = (
    await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: number,
    })
  ).data.filter(
    (file) => file.status === "added" && file.filename.startsWith("text/") && file.filename.includes(".md"),
  );

  if (addedMarkdownFiles.length < 1) {
    return { success: false, error: "RFC markdown file was not found in the PR." };
  }
  if (addedMarkdownFiles.length > 1) {
    return {
      success: false,
      error: `The system can only parse **one** markdown file but more than one were found: ${addedMarkdownFiles
        .map((file) => file.filename)
        .join(",")}. Please, reduce the number of files to **one file** for the system to work.`,
    };
  }

  const [rfcFile] = addedMarkdownFiles;
  const rawText = await (await fetch(rfcFile.raw_url)).text();
  const rfcNumber: string | undefined = rfcFile.filename.split("text/")[1].split("-")[0];
  if (rfcNumber === undefined) {
    return {
      success: false,
      error:
        "Failed to read the RFC number from the filename. Please follow the format: `NNNN-name.md`. Example: `0001-example-proposal.md`",
    };
  }

  return {
    success: true,
    result: {
      approveRemarkText: getApproveRemarkText(rfcNumber, rawText),
      rejectRemarkText: getRejectRemarkText(rfcNumber, rawText),
      rfcFileRawUrl: rfcFile.raw_url,
      rfcNumber,
    },
  };
};

/**
 * Parses the RFC details contained in the PR.
 * The details include the RFC number,
 * a link to the RFC text on GitHub,
 * and the remark text, e.g. RFC_APPROVE(1234,hash)
 */
export const parseRFC = async (requestState: RequestState): Promise<RequestResultFailed | ParseRFCResult> => {
  const { octokitInstance, event } = requestState;

  const result = await extractRfcResult(octokitInstance, {
    repo: event.repository.name,
    owner: event.repository.owner.login,
    number: event.issue.number,
  });
  if (!result.success) {
    return userProcessError(requestState, result.error);
  }
  return result.result;
};

export const getApproveRemarkText = (rfcNumber: string, rawProposalText: string): string =>
  `RFC_APPROVE(${rfcNumber},${hashProposal(rawProposalText)})`;
export const getRejectRemarkText = (rfcNumber: string, rawProposalText: string): string =>
  `RFC_REJECT(${rfcNumber},${hashProposal(rawProposalText)})`;
