import { ScProvider } from '@polkadot/rpc-provider/substrate-connect'
import { ApiPromise, WsProvider } from '@polkadot/api'
import * as SC from '@substrate/connect'
import collectivesChainspec from './chainspecs/collectives-polkadot.json'

export const create = async () => {
  const endpoint = process.env.ENDPOINT || 'wss://polkadot-collectives-rpc.polkadot.io'

  if (endpoint === 'light-client') {
    // Note: light client protocol doesn't have good support for historical state queries
    // It will simply query nodes randomly and hoping it have data
    // In case the remote node is not a archival node, the query will fail with `RemoteCouldntAnswer` error
    // https://github.com/smol-dot/smoldot/issues/1078
    const relaychain = new ScProvider(SC, SC.WellKnownChain.polkadot)
    const parachain = new ScProvider(SC, JSON.stringify(collectivesChainspec), relaychain)
    await parachain.connect()
    return ApiPromise.create({ provider: parachain })
  } else {
    return ApiPromise.create({ provider: new WsProvider(endpoint) })
  }
}
