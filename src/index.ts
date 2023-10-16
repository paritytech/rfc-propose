import * as core from "@actions/core";
import * as githubActions from "@actions/github";
import { envVar } from "@eng-automation/js";
import type { IssueCommentCreatedEvent } from "@octokit/webhooks-types";

import { handleCommand } from "./handle-command";
import { GithubReactionType } from "./types";

export async function run(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const [_, command, ...args] = githubActions.context.payload.comment?.body.split(" ") as (string | undefined)[];
    const respondParams = {
      owner: githubActions.context.repo.owner,
      repo: githubActions.context.repo.repo,
      issue_number: githubActions.context.issue.number,
    };

    const octokitInstance = githubActions.getOctokit(envVar("GH_TOKEN"));
    if (githubActions.context.eventName !== "issue_comment") {
      throw new Error("The action is expected to be run on 'issue_comment' events only.");
    }
    const event: IssueCommentCreatedEvent = githubActions.context.payload as IssueCommentCreatedEvent;
    const requester = event.comment.user.login;

    const githubComment = async (body: string) =>
      await octokitInstance.rest.issues.createComment({
        ...respondParams,
        body,
      });
    const githubEmojiReaction = async (reaction: GithubReactionType) =>
      await octokitInstance.rest.reactions.createForIssueComment({
        ...respondParams,
        comment_id: event.comment.id,
        content: reaction,
      });

    await githubEmojiReaction("eyes");
    try {
      const result = await handleCommand({ command, args, requestState: { event, requester, octokitInstance } });
      if (result.success) {
        await githubComment(result.message);
        await githubEmojiReaction("rocket");
      } else {
        await githubComment(result.errorMessage);
        await githubEmojiReaction("confused");
      }
    } catch (e) {
      const logs = `${githubActions.context.serverUrl}/${githubActions.context.repo.owner}/${githubActions.context.repo.repo}/actions/runs/${githubActions.context.runId}`;
      await githubComment(
        `@${requester} Handling the RFC command failed :(\nYou can open an issue [here](https://github.com/paritytech/rfc-propose/issues/new).\nSee the logs [here](${logs}).`,
      );
      await githubEmojiReaction("confused");
      throw e;
    }
  } catch (error) {
    core.error((error as Error).stack ?? String(error));
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
