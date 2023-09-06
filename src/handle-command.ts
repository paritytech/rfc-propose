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
    const blockHash = args[0];
    return await handleProcessCommand(requestState, blockHash);
  }
  return {
    success: false,
    errorMessage: "Unrecognized command. Expected one of: `propose`, `process`.",
  };
};
