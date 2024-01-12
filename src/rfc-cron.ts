import { getOctokit } from "@actions/github";
import { ApiPromise, WsProvider } from "@polkadot/api";
import fetch from "node-fetch";

import { extractRfcResult } from "./parse-RFC";

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

export const getAllPRs = async (): Promise<void> => {
  const octokit = getOctokit("API-KEY");
  const prs = await octokit.paginate(octokit.rest.pulls.list, { owner: "polkadot-fellows", repo: "RFCs" });
  console.log("PRs", prs.length);

  for (const pr of prs) {
    const { owner, name } = pr.base.repo;
    console.log("Extracting from PR: #%s in %s/%s", pr.number, owner.login, name);
    const rfcResult = await extractRfcResult(octokit, { owner: "polkadot-fellows", repo: "RFCs", number: pr.number });
    if (rfcResult.result) {
      console.log("RFC Result for #%s is", pr.number, rfcResult.result?.approveRemarkText);
    } else {
      console.log("Had an error while creating RFC for #%s", pr.number, rfcResult.error);
    }
  }
};

export const getAllRFCRemarks = async (): Promise<string[]> => {
  const wsProvider = new WsProvider("wss://polkadot-collectives-rpc.polkadot.io");
  try {
    const api = await ApiPromise.create({ provider: wsProvider });
    // We fetch all the members
    const query = (await api.query.fellowshipReferenda.referendumCount()).toPrimitive();
    console.log("referendumCount", query);

    if (typeof query !== "number") {
      throw new Error(`Query result is not a number: ${query}`);
    }
    const ongoing: OnGoing[] = [];
    const remarks: string[] = [];
    for (const index of Array.from(Array(query).keys())) {
      console.log("Fetching element %s/%s", index + 1, query);

      const refQuery = (await api.query.fellowshipReferenda.referendumInfoFor(index)).toJSON() as { ongoing?: OnGoing };
      console.log("Reference query", refQuery);
      if (refQuery.ongoing) {
        ongoing.push(refQuery.ongoing);
        const referendaData = await getReferendaData(refQuery.ongoing.track);
        if (
          referendaData.onchainData?.inlineCall?.call?.args &&
          referendaData.onchainData?.inlineCall?.call?.args[0].name == "remark"
        ) {
          const [call] = referendaData.onchainData?.inlineCall?.call?.args;
          const remark = hexToString(call.value);
          remarks.push(remark);
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

export const cron = async () => {
  const remarks = await getAllRFCRemarks();
  if (remarks.length === 0) {
    console.warn("No ongoing RFCs made from pull requesting. Shuting down");
    return;
  } else {
  }
};

interface OnGoing {
  track: number;
  origin: { fellowshipOrigins: string };
  proposal: { lookup: any };
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
