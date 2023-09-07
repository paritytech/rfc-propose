import { handleProcessCommand } from "./process";
import { handleProposeCommand } from "./propose";
import { RequestResult, RequestState } from "./types";

const usageInstructions = "See [usage instructions](https://github.com/paritytech/rfc-action#usage).";

export const handleCommand = async (opts: {
  command: string | undefined;
  requestState: RequestState;
  args: (string | undefined)[];
}): Promise<RequestResult> => {
  const { command, requestState, args } = opts;
  if (command?.toLowerCase() === "help") {
    return {
      success: true,
      message:
        "The RFC action aims to help with the creation of on-chain RFC referenda and with handling the RFC PRs." +
        "\n\nThe main commands are `/rfc propose` and `/rfc process`.\n\n" +
        usageInstructions,
    };
  }
  if (command?.toLowerCase() === "propose") {
    return await handleProposeCommand(requestState);
  }
  if (command?.toLowerCase() === "process") {
    const blockHash = args[0];
    return await handleProcessCommand(requestState, blockHash);
  }
  return {
    success: false,
    errorMessage: "Unrecognized command. Expected one of: `help`, `propose`, `process`.\n\n" + usageInstructions,
  };
};
