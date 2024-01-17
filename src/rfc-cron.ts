import { debug, error, info, warning } from "@actions/core";
import { summary, SummaryTableRow } from "@actions/core/lib/summary";
import { ApiPromise, WsProvider } from "@polkadot/api";
import fetch from "node-fetch";

import { PROVIDER_URL } from "./constants";
import { extractRfcResult } from "./parse-RFC";
import { ActionLogger, OctokitInstance } from "./types";

const logger: ActionLogger = {
  info,
  debug,
  warn: warning,
  error,
};
const getReferendaData = async (track: number): Promise<ReferendaData> => {
  const url = `https://collectives.subsquare.io/api/fellowship/referenda/${track}.json`;
  const call = await fetch(url);
  const data = (await call.json()) as ReferendaData;
  logger.debug(`Parsed data is ${JSON.stringify(data)}`);
  return data;
};

const hexToString = (hex: string) => {
  let str = "";
  for (let i = 0; i < hex.length; i += 2) {
    const hexValue = hex.substr(i, 2);
    const decimalValue = parseInt(hexValue, 16);
    str += String.fromCharCode(decimalValue);
  }
  return str;
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
    if (rfcResult.result) {
      logger.info(`RFC Result for #${pr.number} is ${rfcResult.result.approveRemarkText}`);
      prRemarks.push([pr.number, rfcResult.result?.approveRemarkText]);
    } else {
      logger.warn(`Had an error while creating RFC for #${pr.number}: ${rfcResult.error}`);
    }
  }

  return prRemarks;
};

export const getAllRFCRemarks = async (startDate: Date): Promise<{ url: string; remark: string }[]> => {
  const wsProvider = new WsProvider(PROVIDER_URL);
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    // We fetch all the available referendas
    const query = (await api.query.fellowshipReferenda.referendumCount()).toPrimitive();

    if (typeof query !== "number") {
      throw new Error(`Query result is not a number: ${typeof query}`);
    }

    logger.info(`Available referendas: ${query}`);
    const remarks: { url: string; remark: string }[] = [];
    for (const index of Array.from(Array(query).keys())) {
      logger.info(`Fetching elements ${index + 1}/${query}`);

      const refQuery = (await api.query.fellowshipReferenda.referendumInfoFor(index)).toJSON() as { ongoing?: OnGoing };

      if (refQuery.ongoing) {
        logger.info(`Found ongoing request: ${JSON.stringify(refQuery)}`);
        const blockNr = refQuery.ongoing.submitted;
        const blockDate = await getBlockDate(blockNr, api);

        if (startDate > blockDate) {
          logger.info("Referenda is older than previous check. Ignoring.");
        }

        const referendaData = await getReferendaData(refQuery.ongoing.track);
        if (
          referendaData.onchainData?.inlineCall?.call?.args &&
          referendaData.onchainData?.inlineCall?.call?.args[0].name == "remark"
        ) {
          const [call] = referendaData.onchainData.inlineCall.call.args;
          const remark = hexToString(call.value);
          remarks.push({
            remark,
            url: `https://collectives.polkassembly.io/referenda/${referendaData.polkassemblyId}`,
          });
        }
      } else {
        logger.debug(`Reference query is not ongoing: ${JSON.stringify(refQuery)}`);
      }
    }

    logger.info(`Found ${remarks.length} ongoing requests`);

    return remarks;
  } catch (err) {
    logger.error("Error during exectuion");
    throw err;
  } finally {
    await wsProvider.disconnect();
  }
};

export const cron = async (startDate: Date, owner: string, repo: string, octokit: OctokitInstance): Promise<void> => {
  const remarks = await getAllRFCRemarks(startDate);
  if (remarks.length === 0) {
    logger.warn("No ongoing RFCs made from pull requesting. Shuting down");
    await summary.addHeading("Referenda search", 3).addHeading("Found no matching referenda to open PRs").write();
    return;
  }
  logger.debug(`Found remarks ${JSON.stringify(remarks)}`);
  const prRemarks = await getAllPRs(octokit, { owner, repo });
  logger.debug(`Found all PR remarks ${JSON.stringify(prRemarks)}`);

  const rows: SummaryTableRow[] = [
    [
      { data: "PR", header: true },
      { data: "Referenda", header: true },
    ],
  ];
  for (const [pr, remark] of prRemarks) {
    const match = remarks.find((r) => r.remark === remark);
    if (match) {
      logger.info(`Found existing referenda for PR #${pr}`);
      const msg = `Voting for this referenda is **ongoing**.\n\nVote for it [here]${match.url}`;
      rows.push([`${owner}/${repo}#${pr}`, `<a href="${match.url}">${match.url}</a>`]);
      await octokit.rest.issues.createComment({ owner, repo, issue_number: pr, body: msg });
    }
  }

  await summary
    .addHeading("Referenda search", 3)
    .addHeading(`Found ${rows.length - 1} ongoing referendas`, 5)
    .addTable(rows)
    .write();
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

interface ReferendaData {
  _id: string;
  referendumIndex: number;
  proposer: string;
  title: string;
  content: string;
  contentType: string | "markdown";
  track: number;
  createdAt: Date;
  updatedAt: Date;
  edited: boolean;
  polkassemblyId: number;
  onchainData?: {
    _id: string;
    referendumIndex: number;
    track: number;
    state: {
      name: string;
    };
    inlineCall?: {
      hex: string;
      hash: string;
      call?: {
        callIndex: string;
        section: string;
        method: "remark" | string;
        args: {
          name: "remark" | string;
          type: "Bytes" | string;
          value: string;
        }[];
      };
    };
  };
}
