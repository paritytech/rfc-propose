import { debug, error, info, warning } from "@actions/core";
import { summary, SummaryTableRow } from "@actions/core/lib/summary";
import { ApiPromise, WsProvider } from "@polkadot/api";

import { PROVIDER_URL } from "./constants";
import { extractRfcResult } from "./parse-RFC";
import { ReferendaObject, SubsquareApi } from "./subsquare";
import { ActionLogger, OctokitInstance } from "./types";

const logger: ActionLogger = {
  info,
  debug,
  warn: warning,
  error,
};

/** Gets the date of a block */
const getBlockDate = async (blockNr: number, api: ApiPromise): Promise<Date> => {
  const hash = await api.rpc.chain.getBlockHash(blockNr);
  const timestamp = await api.query.timestamp.now.at(hash);
  return new Date(timestamp.toPrimitive() as string);
};

export const getAllPRs = async (
  octokit: OctokitInstance,
  repo: { owner: string; repo: string },
): Promise<[number, string][]> => {
  const prs = await octokit.paginate(octokit.rest.pulls.list, repo);

  logger.info(`Found ${prs.length} open PRs`);

  const prRemarks: [number, string][] = [];

  for (const pr of prs) {
    const { owner, name } = pr.base.repo;
    logger.info(`Extracting from PR: #${pr.number} in ${owner.login}/${name}`);
    const rfcResult = await extractRfcResult(octokit, { ...repo, number: pr.number });
    if (rfcResult.success) {
      logger.info(`RFC Result for #${pr.number} is ${rfcResult.result.approveRemarkText}`);
      prRemarks.push([pr.number, rfcResult.result?.approveRemarkText]);
    } else {
      logger.warn(`Had an error while creating RFC for #${pr.number}: ${rfcResult.error}`);
    }
  }

  return prRemarks;
};

type OpenReferenda = { url: string; hash: string };
/** Either completed, rejected or timeout. Basically NOT active */
type FinishedReferenda = number;

export const getAllRFCRemarks = async (
  startDate: Date,
): Promise<{ ongoing: OpenReferenda[]; finished: FinishedReferenda[] }> => {
  const wsProvider = new WsProvider(PROVIDER_URL);
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    // We fetch all the available referendas
    const query = (await api.query.fellowshipReferenda.referendumCount()).toPrimitive();

    if (typeof query !== "number") {
      throw new Error(`Query result is not a number: ${typeof query}`);
    }

    logger.info(`Available referendas: ${query}`);
    const ongoing: OpenReferenda[] = [];
    const finished: FinishedReferenda[] = [];

    for (const index of Array.from(Array(query).keys())) {
      logger.info(`Fetching elements ${index + 1}/${query}`);

      type Finished = [number, ...unknown[]];

      const refInfo = (await api.query.fellowshipReferenda.referendumInfoFor(index)).toJSON() as {
        ongoing?: OnGoing;
        approved?: Finished;
        rejected?: Finished;
        timedOut?: Finished;
        killed?: Finished;
        cancelled?: Finished;
      };

      if (refInfo.ongoing) {
        logger.info(`Found ongoing request: ${JSON.stringify(refInfo)}`);
        const blockNr = refInfo.ongoing.submitted;
        const blockDate = await getBlockDate(blockNr, api);

        logger.debug(
          `Checking if the startDate (${startDate.toString()}) is newer than the block date (${blockDate.toString()})`,
        );
        // Skip referendas that have been interacted with last time
        if (startDate > blockDate) {
          logger.info(`Referenda #${index} is older than previous check. Ignoring.`);
          continue;
        }

        const { proposal } = refInfo.ongoing;
        const hash = proposal?.lookup?.hash ?? proposal?.inline;
        if (hash) {
          ongoing.push({ hash, url: `https://collectives.polkassembly.io/referenda/${index}` });
        } else {
          logger.warn(
            `Found no lookup hash nor inline hash for https://collectives.polkassembly.io/referenda/${index}`,
          );
          continue;
        }
      } else {
        const { approved, rejected, timedOut, killed, cancelled } = refInfo;
        const date = approved?.[0] ?? rejected?.[0] ?? timedOut?.[0] ?? killed?.[0] ?? cancelled?.[0] ?? null;

        if (!date) {
          logger.warn(`Referendum state will not be handled ${JSON.stringify(refInfo)}`);
          continue;
        }

        const blockDate = await getBlockDate(date, api);
        if (startDate > blockDate) {
          logger.info(`Completed state for referenda #${index} happened before the previous check. Ignoring.`);
          continue;
        }

        finished.push(index);
      }
    }

    logger.info(`Found ${ongoing.length} ongoing and ${finished.length} completed requests`);

    return { ongoing, finished };
  } catch (err) {
    logger.error("Error during exectuion");
    throw err;
  } finally {
    await wsProvider.disconnect();
  }
};

const fetchFinishedReferendaInfo = async (
  completedReferendas: FinishedReferenda[],
): Promise<{ hash: string; executedHash: string; index: number; state: ReferendaObject["state"]["name"] }[]> => {
  const subsquareApi = new SubsquareApi();
  const referendas: { hash: string; executedHash: string; index: number; state: ReferendaObject["state"]["name"] }[] =
    [];
  for (const index of completedReferendas) {
    logger.debug(`Fetching info from referenda ${index} from Subsquare`);
    const rfc = await subsquareApi.fetchReferenda(index);
    const finishedBlock = rfc.onchainData.timeline.find(
      ({ name }) =>
        name === "Confirmed" || name === "Rejected" || name === "TimedOut" || name === "Killed" || name === "Cancelled",
    );
    if (finishedBlock) {
      referendas.push({
        hash: rfc.onchainData.proposalHash,
        executedHash: finishedBlock.indexer.blockHash,
        index,
        state: rfc.state.name,
      });
    }
  }

  return referendas;
};

export const cron = async (startDate: Date, owner: string, repo: string, octokit: OctokitInstance): Promise<void> => {
  const { ongoing, finished } = await getAllRFCRemarks(startDate);
  if (ongoing.length === 0 && finished.length === 0) {
    logger.warn("No RFCs made from pull requests found. Shuting down");
    await summary.addHeading("Referenda search", 3).addHeading("Found no matching referenda since last run", 5).write();
    return;
  }

  const finishedReferendas = await fetchFinishedReferendaInfo(finished);

  logger.debug(`Found remarks ${JSON.stringify(ongoing)}`);
  const prRemarks = await getAllPRs(octokit, { owner, repo });
  logger.debug(`Found all PR remarks ${JSON.stringify(prRemarks)}`);

  const rows: SummaryTableRow[] = [
    [
      { data: "PR", header: true },
      { data: "Referenda", header: true },
      { data: "Status", header: true },
    ],
  ];

  const wsProvider = new WsProvider(PROVIDER_URL);
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    for (const [pr, remark] of prRemarks) {
      // We compare the hash to see if there is a match
      const tx = api.tx.system.remark(remark);

      // We first start with ongoing referendas
      const match = ongoing.find(({ hash }) => hash === tx.method.hash.toHex() || hash === tx.method.toHex());
      if (match) {
        logger.info(`Found existing referenda for PR #${pr}`);
        const msg = `Voting for this referenda is **ongoing**.\n\nVote for it [here](${match.url})`;
        rows.push([`${owner}/${repo}#${pr}`, `<a href="${match.url}">${match.url}</a>`]);
        await octokit.rest.issues.createComment({ owner, repo, issue_number: pr, body: msg });
      }

      // if we don't find a match, we search for a closed referenda
      const completedMatch = finishedReferendas.find(
        ({ hash }) => hash === tx.method.hash.toHex() || hash === tx.method.toHex(),
      );
      if (completedMatch) {
        logger.info(`Found finished referenda for PR #${pr} with state ${completedMatch.state}`);
        const command = `/rfc process ${completedMatch.executedHash}`;
        const nonApprovedMsg = `Referenda voting has finished with status \`${completedMatch.state}\``;
        const approvedMsg =
          "PR can be merged." + "\n\nWrite the following command to trigger the bot\n\n" + `\`${command}\``;
        rows.push([
          `${owner}/${repo}#${pr}`,
          `<a href="https://collectives.polkassembly.io/referenda/${completedMatch.index}>RFC ${completedMatch.index}</a>`,
          completedMatch.state,
        ]);
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pr,
          body: completedMatch.state === "Executed" ? approvedMsg : nonApprovedMsg,
        });
      }
    }
  } catch (e) {
    logger.error(e as Error);
    throw new Error("There was a problem during the commenting");
  } finally {
    await wsProvider.disconnect();
  }

  if (rows.length > 1) {
    await summary
      .addHeading("Referenda search", 3)
      .addHeading(`Found ${rows.length - 1} PRs matching ongoing referendas`, 5)
      .addTable(rows)
      .write();
  } else {
    await summary.addHeading("Referenda search", 3).addHeading("Found no matching referenda to open PRs", 5).write();
  }

  logger.info("Finished run");
};

interface OnGoing {
  track: number;
  origin: { fellowshipOrigins: string };
  proposal: { lookup?: { hash: string }; inline?: string };
  enactment: { after: number };
  submitted: number;
  submissionDeposit: {
    who: string;
    amount: number;
  };
  decisionDeposit: {
    who: string;
    amount: number;
  };
  deciding: { since: number; confirming: null };
  tally: Record<string, number>;
  inQueue: boolean;
}
