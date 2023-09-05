import { handleProcessCommand } from "./commands/process";
import { handleProposeCommand } from "./commands/propose";
import { RequestResult, RequestState } from "./types";

export const handleCommand = async (opts: {
  command: string | undefined;
  requestState: RequestState;
  args: (string | undefined)[];
}): Promise<RequestResult> => {
  const { command, requestState, args } = opts;
  if (command?.toLowerCase() === "propose") {
    return await handleProposeCommand(requestState);
  }
  if (command?.toLowerCase() === "process") {
    const arg = args[0];
    if (!arg && !arg?.startsWith("0x")) {
      return {
        success: false,
        errorMessage:
          "Please provider a block hash where the referendum is to be found.\nFor example:\n\n```\n/rfc process 0x39fbc57d047c71f553aa42824599a7686aea5c9aab4111f6b836d35d3d058162\n```\n",
      };
    }
    return await handleProcessCommand(requestState, arg);
  }
  return {
    success: false,
    errorMessage: "Unrecognized command. Expected one of: `propose`, `process`.",
  };
};
