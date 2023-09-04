import * as github from '@actions/github'
import { expect, test } from '@jest/globals'
import { config } from 'dotenv'

import processCmd from '../src/process'

config()

test('processCmd', async () => {
  const ctx = {
    owner: 'xlc',
    repo: 'RFCs',
    issue_number: 14
  }
  const octokit = github.getOctokit(process.env.GH_TOKEN!)
  expect(
    await processCmd(
      octokit,
      '/bot merge blockhash=0x39fbc57d047c71f553aa42824599a7686aea5c9aab4111f6b836d35d3d058162',
      ctx
    )
  ).toMatchSnapshot()
}, 100000)
