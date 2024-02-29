import fetch from "node-fetch";

import { SUBSQUARE_API } from "./constants";

interface ReferendaObject {
  _id: string;
  referendumIndex: number;
  title: string;
  content: string;
  track: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  state: {
    name: "Executed" | string;
  };
  onchainData: {
    /** Compare this to tx.method.hash.toHex() */
    proposalHash: string;
    timeline: {
      _id: string;
      referendumIndex: number;
      name: "Executed" | "Confirmed" | "ConfirmStarted" | "DecisionStarted";
      indexer: {
        blockHeight: number;
        /** Use this when generating the comment */
        blockHash: string;
        blockTime: number;
      };
    }[];
  };
}

export class SubsquareApi {
  private readonly url: string;
  constructor() {
    this.url = SUBSQUARE_API;
  }

  async fetchReferenda(index: number): Promise<ReferendaObject> {
    const request = await fetch(`${this.url}/api/fellowship/referenda/${index}.json`);
    return await request.json();
  }
}
