import { summary, SummaryTableRow } from "@actions/core/lib/summary";
import { ApiPromise, WsProvider } from "@polkadot/api";
import fetch from "node-fetch";

import { extractRfcResult } from "./parse-RFC";
import { OctokitInstance } from "./types";

const getReferendaData = async (track: number): Promise<ReferendaData> => {
  const url = `https://collectives.subsquare.io/api/fellowship/referenda/${track}.json`;
  const call = await fetch(url);
  const data = (await call.json()) as ReferendaData;
  console.log("Parsed data is", data);
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

  console.log("PRs", prs.length);

  const prRemarks: [number, string][] = [];

  for (const pr of prs) {
    const { owner, name } = pr.base.repo;
    console.log("Extracting from PR: #%s in %s/%s", pr.number, owner.login, name);
    const rfcResult = await extractRfcResult(octokit, { ...repo, number: pr.number });
    if (rfcResult.result) {
      console.log("RFC Result for #%s is", pr.number, rfcResult.result.approveRemarkText);
      prRemarks.push([pr.number, rfcResult.result?.approveRemarkText]);
    } else {
      console.log("Had an error while creating RFC for #%s", pr.number, rfcResult.error);
    }
  }

  return prRemarks;
};

export const getAllRFCRemarks = async (startDate: Date): Promise<{ url: string; remark: string }[]> => {
  const wsProvider = new WsProvider("wss://polkadot-collectives-rpc.polkadot.io");
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    // We fetch all the members
    const query = (await api.query.fellowshipReferenda.referendumCount()).toPrimitive();
    console.log("referendumCount", query);

    if (typeof query !== "number") {
      throw new Error(`Query result is not a number: ${typeof query}`);
    }
    const ongoing: OnGoing[] = [];
    const remarks: { url: string; remark: string }[] = [];
    for (const index of Array.from(Array(query).keys())) {
      console.log("Fetching element %s/%s", index + 1, query);

      const refQuery = (await api.query.fellowshipReferenda.referendumInfoFor(index)).toJSON() as { ongoing?: OnGoing };
      console.log("Reference query", refQuery);
      if (refQuery.ongoing) {
        const blockNr = refQuery.ongoing.submitted;
        const blockDate = await getBlockDate(blockNr, api);

        console.warn("date", blockDate);
        if (startDate > blockDate) {
          console.log("Referenda is older than previous check. Ignoring.");
        }

        ongoing.push(refQuery.ongoing);

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
      }
    }

    console.log(`Found ${ongoing.length} ongoing requests`, ongoing);

    return remarks;
  } catch (err) {
    console.error("Error during exectuion");
    throw err;
  } finally {
    await wsProvider.disconnect();
  }
};

export const cron = async (startDate: Date, owner: string, repo: string, octokit: OctokitInstance): Promise<void> => {
  const remarks = await getAllRFCRemarks(startDate);
  if (remarks.length === 0) {
    console.warn("No ongoing RFCs made from pull requesting. Shuting down");
    return;
  }
  console.log("Found remarks", remarks);
  const prRemarks = await getAllPRs(octokit, { owner, repo });
  console.log("Found all PR remarks", prRemarks);

  const rows: SummaryTableRow[] = [
    [
      { data: "PR", header: true },
      { data: "Referenda", header: true },
    ],
  ];
  for (const [pr, remark] of prRemarks) {
    const match = remarks.find((r) => r.remark === remark);
    if (match) {
      console.log("Found existing referenda for PR #%s", pr);
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
  proposal: { lookup: unknown };
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
