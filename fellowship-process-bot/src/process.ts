import * as github from '@actions/github'
import { blake2AsHex } from '@polkadot/util-crypto'
import '@polkadot/api/augment'

import parse from './parse'
import { create } from './api'

type Context = {
  owner: string
  repo: string
  issue_number: number
}

const processCmd = async (octokit: ReturnType<typeof github.getOctokit>, rawcmd: string, ctx: Context) => {
  const { cmd, getArg, rawArgs } = parse(rawcmd)
  if (!cmd) {
    console.log('No command found')
    return
  }

  const getRemarkBody = async (action: 'approve' | 'reject') => {
    const files = await octokit.rest.pulls.listFiles({
      owner: ctx.owner,
      repo: ctx.repo,
      pull_number: ctx.issue_number
    })
    const file = files.data.find(file => file.filename.match(/\d{4}-.+\.md$/i))
    if (!file) {
      return {
        error: 'Unable to find proposal document'
      }
    }
    if (files.data.length > 1) {
      return {
        error: 'More than one proposal document found'
      }
    }

    const prInfo = await octokit.rest.pulls.get({
      owner: ctx.owner,
      repo: ctx.repo,
      pull_number: ctx.issue_number
    })
    const headSha = prInfo.data.head.sha

    const body = await octokit.rest.repos.getContent({
      owner: ctx.owner,
      repo: ctx.repo,
      path: file.filename,
      ref: headSha,
      headers: {
        accept: 'application/vnd.github.v3.raw'
      }
    })
    const hex = blake2AsHex(body.data.toString(), 256).substring(2)
    const rpc_number = ctx.issue_number.toString().padStart(4, '0')

    let remarkBody
    switch (action) {
      case 'approve':
        remarkBody = `RFC_APPROVE(${rpc_number},${hex})`
        break
      case 'reject':
        remarkBody = `RFC_REJECT(${rpc_number},${hex})`
        break
    }

    return {
      headSha,
      remarkBody
    }
  }

  const handleRfc = async (action: 'approve' | 'reject') => {
    const blockHash = getArg('blockhash')
    if (!blockHash) {
      return {
        createComment: 'Missing block hash'
      }
    }

    const { remarkBody, headSha, error } = await getRemarkBody(action)
    if (error) {
      return {
        createComment: error
      }
    }
    if (!remarkBody) {
      return {
        createComment: 'Unable to generate remark body'
      }
    }

    const api = await create()

    const apiAt = await api.at(blockHash)
    const apiAtPrev = await api.at((await api.rpc.chain.getHeader(blockHash)).parentHash)

    const remarkBodyHash = api.tx.system.remark(remarkBody).method.hash.toHex()

    const events = await apiAt.query.system.events()
    for (const evt of events) {
      if (evt.event.section === 'fellowshipReferenda' && evt.event.method === 'Confirmed') {
        const [referendumIndex] = evt.event.data
        const info = await apiAtPrev.query.fellowshipReferenda.referendumInfoFor(referendumIndex)
        const infoJson = info.toJSON() as any
        const proposalHash = infoJson?.ongoing?.proposal?.lookup?.hash

        if (proposalHash === remarkBodyHash) {
          await api.disconnect()

          switch (action) {
            case 'approve':
              return {
                merge: headSha,
                createComment: `RFC ${ctx.issue_number} approved. Merging ${headSha.substring(0, 8)} into master`
              }
            case 'reject':
              return {
                close: true,
                createComment: `RFC ${ctx.issue_number} rejected. Closing PR`
              }
          }
        }
      }
    }
    return {
      createComment: `Unable to find fellowshipReferenda.confirmed event at \`${blockHash}\` for proposal with preimage \`${remarkBodyHash}\``
    }
  }

  const handlers = {
    async ping() {
      return {
        createComment: `pong ${rawArgs.substring(0, 10)}`
      }
    },
    async merge() {
      return handleRfc('approve')
    },
    async close() {
      return handleRfc('reject')
    },
    async head() {
      const api = await create()
      const head = await new Promise(resolve => {
        api.rpc.chain.subscribeNewHeads(head => {
          resolve(head.hash.toHex())
        })
      })
      await api.disconnect()
      return {
        createComment: `Current head: ${head}`
      }
    }
  }

  if (cmd in handlers) {
    return handlers[cmd as keyof typeof handlers]() as Promise<
      { createComment?: string; merge?: string; close?: boolean } | undefined
    >
  } else {
    return {
      createComment: `Unknown command: ${cmd}`
    }
  }
}

export default processCmd
