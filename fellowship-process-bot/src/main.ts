import * as github from '@actions/github'

import processCmd from './process'

const main = async () => {
  const rawcmd: string = github.context.payload.comment?.body
  if (!rawcmd) {
    console.log('No comment body found')
    return
  }

  const githubToken = process.env.GH_TOKEN
  const PAT = process.env.GH_PAT || githubToken
  if (!githubToken) {
    throw new Error('GH_TOKEN is not set')
  }
  if (!PAT) {
    throw new Error('this is unreachable')
  }
  const octokit = github.getOctokit(githubToken)

  const result = await processCmd(octokit, rawcmd, {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: github.context.issue.number
  })

  if (!result) {
    console.log('No result')
    return
  }

  console.log('Result', result)

  // use a PAT to merge the PR
  const patOctokit = github.getOctokit(PAT)

  if (result.createComment) {
    await octokit.rest.issues.createComment({
      ...github.context.repo,
      issue_number: github.context.issue.number,
      body: result.createComment
    })
  }

  if (result.merge) {
    // approve the pr
    try {
      await patOctokit.rest.pulls.createReview({
        ...github.context.repo,
        pull_number: github.context.issue.number,
        event: 'APPROVE'
      })
    } catch (e) {
      console.log('Unable to approve PR', e)
    }

    await patOctokit.rest.pulls.merge({
      ...github.context.repo,
      pull_number: github.context.issue.number,
      sha: result.merge
    })
  }

  if (result.close) {
    await patOctokit.rest.issues.update({
      ...github.context.repo,
      issue_number: github.context.issue.number,
      state: 'closed'
    })
  }
}

main()
  // eslint-disable-next-line github/no-then
  .catch(console.error)
  .finally(() => process.exit())
