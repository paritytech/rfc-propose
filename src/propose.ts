import { parseRFC } from "./parse-RFC";
import { createReferendumTx } from "./referendum-tx";
import { RequestResult, RequestState } from "./types";
import { extractCommitHash } from "./util";

export const handleProposeCommand = async (requestState: RequestState): Promise<RequestResult> => {
  const parseRFCResult = await parseRFC(requestState);
  if ("success" in parseRFCResult) {
    return parseRFCResult;
  }

  const { transactionCreationUrl, remarkText } = await createReferendumTx({
    remarkText: parseRFCResult.approveRemarkText,
  });

  const message =
    `Hey @${requestState.requester}, ` +
    `[here is a link](${transactionCreationUrl}) you can use to create the referendum aiming to approve this RFC number ${parseRFCResult.rfcNumber}.` +
    `\n\n<details><summary>Instructions</summary>` +
    `\n\n1. Open the [link](${transactionCreationUrl}).` +
    `\n\n2. Switch to the \`Submission\` tab.` +
    `\n<img width="480px" src="https://raw.githubusercontent.com/paritytech/rfc-propose/main/src/images/submission_tab.png" />` +
    `\n\n3. Adjust the transaction if needed (for example, the proposal Origin).` +
    `\n\n4. Submit the Transaction` +
    `\n</details>\n\n---` +
    `\n\nIt is based on commit hash [${extractCommitHash(parseRFCResult.rfcFileRawUrl)}](${
      parseRFCResult.rfcFileRawUrl
    }).` +
    `\n\nThe proposed remark text is: \`${remarkText}\`.`;

  return { success: true, message };
};
