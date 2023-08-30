import * as githubActions from "@actions/github";
import type { IssueCommentCreatedEvent } from "@octokit/webhooks-types";
import fetch from "node-fetch";

import { createReferendumTx } from "./referendum-tx";
import { extractCommitHash } from "./util";

export const handleRFCReferendumRequest = async (
  event: IssueCommentCreatedEvent,
  requester: string,
  octokitInstance: ReturnType<(typeof githubActions)["getOctokit"]>,
): Promise<{ success: true; message: string } | { success: false; errorMessage: string }> => {
  const userError = (message: string) =>
    ({
      success: false,
      errorMessage: `@${requester} ${message} Please double check the [Process](https://github.com/polkadot-fellows/RFCs#process)`,
    }) as const;

  const addedMarkdownFiles = (
    await octokitInstance.rest.pulls.listFiles({
      repo: event.repository.name,
      owner: event.repository.owner.login,
      pull_number: event.issue.number,
    })
  ).data.filter(
    (file) => file.status === "added" && file.filename.startsWith("text/") && file.filename.includes(".md"),
  );
  if (addedMarkdownFiles.length < 1) {
    return userError("RFC markdown file was not found in the PR.");
  }
  if (addedMarkdownFiles.length > 1) {
    return userError(
      `The system can only parse **one** markdown file but more than one were found: ${addedMarkdownFiles
        .map((file) => file.filename)
        .join(",")}. Please, reduce the number of files to **one file** for the system to work.`,
    );
  }
  const [rfcFile] = addedMarkdownFiles;
  const rawText = await (await fetch(rfcFile.raw_url)).text();
  const rfcNumber: string | undefined = rfcFile.filename.split("text/")[1].split("-")[0];
  if (rfcNumber === undefined) {
    return userError(
      "Failed to read the RFC number from the filename. Please follow the format: `NNNN-name.md`. Example: `0001-example-proposal.md`",
    );
  }

  const { transactionCreationUrl, remarkText } = await createReferendumTx({ rfcProposalText: rawText, rfcNumber });

  const message =
    `Hey @${requester}, ` +
    `[here is a link](${transactionCreationUrl}) you can use to create the referendum aiming to approve this RFC number ${rfcNumber}.` +
    `\n\n<details><summary>Instructions</summary>` +
    `\n\n1. Open the [link](${transactionCreationUrl}).` +
    `\n\n2. Switch to the \`Submission\` tab.` +
    `\n<img width="480px" src="https://raw.githubusercontent.com/paritytech/rfc-propose/main/src/images/submission_tab.png" />` +
    `\n\n3. Adjust the transaction if needed (for example, the proposal Origin).` +
    `\n\n4. Submit the Transaction` +
    `\n</details>\n\n---` +
    `\n\nIt is based on commit hash [${extractCommitHash(rfcFile.raw_url)}](${rfcFile.raw_url}).` +
    `\n\nThe proposed remark text is: \`${remarkText}\`.`;

  return { success: true, message };
};
