import { debug, error, info, warning } from "@actions/core";
import { summary, SummaryTableRow } from "@actions/core/lib/summary";
import { ApiPromise, WsProvider } from "@polkadot/api";

import { PROVIDER_URL } from "./constants";
import { extractRfcResult } from "./parse-RFC";
import { SubsquareApi } from "./subsquare";
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
type CompletedReferenda = number;

export const getAllRFCRemarks = async (
  startDate: Date,
): Promise<{ ongoing: OpenReferenda[]; completed: CompletedReferenda[] }> => {
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
    const completed: CompletedReferenda[] = [];

    for (const index of Array.from(Array(query).keys())) {
      logger.info(`Fetching elements ${index + 1}/${query}`);

      const refInfo = (await api.query.fellowshipReferenda.referendumInfoFor(index)).toJSON() as {
        ongoing?: OnGoing;
        approved?: [number, unknown | null, unknown | null];
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
      } else if (refInfo.approved) {
        logger.debug(`Referendum has been approved: ${JSON.stringify(refInfo)}`);
        const [approvalDate] = refInfo.approved;
        const blockDate = await getBlockDate(approvalDate, api);
        if (startDate > blockDate) {
          logger.info(`Confirmation of referenda #${index} happened before the previous check. Ignoring.`);
          continue;
        }

        completed.push(index);
      } else {
        logger.debug(`Referendum state will not be handled ${JSON.stringify(refInfo)}`);
      }
    }

    logger.info(`Found ${ongoing.length} ongoing and ${completed.length} completed requests`);

    return { completed, ongoing };
  } catch (err) {
    logger.error("Error during exectuion");
    throw err;
  } finally {
    await wsProvider.disconnect();
  }
};

const fetchCompletedReferendaInfo = async (
  completedReferendas: CompletedReferenda[],
): Promise<{ hash: string; executedHash: string; index: number }[]> => {
  const subsquareApi = new SubsquareApi();
  const referendas: { hash: string; executedHash: string; index: number }[] = [];
  for (const index of completedReferendas) {
    logger.debug(`Fetching info from referenda ${index} from Subsquare`);
    const rfc = await subsquareApi.fetchReferenda(index);
    const confirmedBlock = rfc.onchainData.timeline.find(({ name }) => name === "Confirmed");
    if (confirmedBlock) {
      referendas.push({
        hash: rfc.onchainData.proposalHash,
        executedHash: confirmedBlock.indexer.blockHash,
        index,
      });
    }
  }

  return referendas;
};

export const cron = async (startDate: Date, owner: string, repo: string, octokit: OctokitInstance): Promise<void> => {
  const { ongoing, completed } = await getAllRFCRemarks(startDate);
  if (ongoing.length === 0 && completed.length === 0) {
    logger.warn("No RFCs made from pull requests found. Shuting down");
    await summary.addHeading("Referenda search", 3).addHeading("Found no matching referenda to open PRs", 5).write();
    return;
  }

  const completedReferendas = await fetchCompletedReferendaInfo(completed);

  logger.debug(`Found remarks ${JSON.stringify(ongoing)}`);
  const prRemarks = await getAllPRs(octokit, { owner, repo });
  logger.debug(`Found all PR remarks ${JSON.stringify(prRemarks)}`);

  const rows: SummaryTableRow[] = [
    [
      { data: "PR", header: true },
      { data: "Referenda", header: true },
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
      const completedMatch = completedReferendas.find(
        ({ hash }) => hash === tx.method.hash.toHex() || hash === tx.method.toHex(),
      );
      if (completedMatch) {
        logger.info(`Found completed referenda for PR #${pr}`);
        const command = `/rfc process ${completedMatch.executedHash}`;
        const msg = "PR can be merged. Write the following command to trigger the bot" + `\n\n\`${command}\``;
        rows.push([
          `${owner}/${repo}#${pr}`,
          `<a href="https://collectives.polkassembly.io/referenda/${completedMatch.index}>RFC ${completedMatch.index}</a>`,
        ]);
        await octokit.rest.issues.createComment({ owner, repo, issue_number: pr, body: msg });
      }
    }
  } catch (e) {
    logger.error(e as Error);
    throw new Error("There was a problem during the commenting");
  } finally {
    await wsProvider.disconnect();
  }

  await summary
    .addHeading("Referenda search", 3)
    .addHeading(`Found ${rows.length - 1} PRs matching ongoing referendas`, 5)
    .addTable(rows)
    .write();

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
