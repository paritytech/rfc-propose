import * as core from "@actions/core";
import * as githubActions from "@actions/github";
import { envVar } from "@eng-automation/js";
import type { IssueCommentCreatedEvent } from "@octokit/webhooks-types";

import { START_DATE } from "./constants";
import { cron } from "./cron";
import { handleCommand } from "./handle-command";
import { GithubReactionType } from "./types";

export async function run(): Promise<void> {
  const { context } = githubActions;
  try {
    const octokitInstance = githubActions.getOctokit(envVar("GH_TOKEN"));
    if (context.eventName === "schedule" || context.eventName === "workflow_dispatch") {
      const { owner, repo } = context.repo;
      return await cron(new Date(START_DATE), owner, repo, octokitInstance);
    } else if (context.eventName !== "issue_comment") {
      throw new Error("The action is expected to be run on 'issue_comment' events only.");
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const [_, command, ...args] = context.payload.comment?.body.split(" ") as (string | undefined)[];
    const respondParams = {
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
    };

    const event: IssueCommentCreatedEvent = context.payload as IssueCommentCreatedEvent;
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
      const logs = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
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
