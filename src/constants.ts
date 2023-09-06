export const PROVIDER_URL = process.env.PROVIDER_URL || "wss://polkadot-collectives-rpc.polkadot.io";
export const POLKADOT_APPS_URL = `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(PROVIDER_URL)}#/`;
