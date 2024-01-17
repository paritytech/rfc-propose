// https://docs.github.com/en/rest/reactions/reactions#about-reactions
import * as githubActions from "@actions/github";
import { IssueCommentCreatedEvent } from "@octokit/webhooks-types";

export type GithubReactionType = "+1" | "-1" | "laugh" | "confused" | "heart" | "hooray" | "rocket" | "eyes";

export type RequestState = {
  event: IssueCommentCreatedEvent;
  requester: string;
  octokitInstance: OctokitInstance;
};

export type OctokitInstance = ReturnType<(typeof githubActions)["getOctokit"]>;

export type RequestResult = { success: true; message: string } | { success: false; errorMessage: string };
export type RequestResultFailed = RequestResult & { success: false };

export interface ActionLogger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string | Error): void;
  error(message: string | Error): void;
}
