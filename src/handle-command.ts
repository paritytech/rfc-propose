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
          "Please provider a block hash where the referendum confirmation event is to be found.\n" +
          "For example:\n\n" +
          "```\n/rfc process 0x39fbc57d047c71f553aa42824599a7686aea5c9aab4111f6b836d35d3d058162\n```\n" +
          `\n<details><summary>Instructions to find the block hash</summary>` +
          "Here is one way to find the corresponding block hash." +
          `\n\n1. Open the referendum on Subsquare` +
          "\n\n2. Switch to the `Timeline` tab." +
          `\n<img width="480px" src="https://raw.githubusercontent.com/paritytech/rfc-propose/rzadp/fellowship-process-bot/src/images/timeline_tab.png" />` +
          "\n\n3. Go to the details of the `Confirmed` event" +
          `\n<img width="480px" src="https://raw.githubusercontent.com/paritytech/rfc-propose/rzadp/fellowship-process-bot/src/images/confirmed_event.png" />` +
          `\n\n2. Go to the details of the block containing that event.` +
          `\n<img width="480px" src="https://raw.githubusercontent.com/paritytech/rfc-propose/rzadp/fellowship-process-bot/src/images/block_number.png" />` +
          `\n\n2. Here you can find the block hash.` +
          `\n<img width="480px" src="https://raw.githubusercontent.com/paritytech/rfc-propose/rzadp/fellowship-process-bot/src/images/block_hash.png" />` +
          `\n</details>`,
      };
    }
    return await handleProcessCommand(requestState, arg);
  }
  return {
    success: false,
    errorMessage: "Unrecognized command. Expected one of: `propose`, `process`.",
  };
};
