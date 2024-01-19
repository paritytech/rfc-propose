# rfc-propose

## Description

A GitHub Action aiming to help in the creation of RFC proposal referenda.

Learn more about the RFC proposal process [here](https://github.com/polkadot-fellows/RFCs#process).

## Usage

On an RFC Pull Request, add a comment starting with `/rfc`.

### Commands

1. Propose

Proposes the creation of a referendum aiming to approve the given RFC.

```
/rfc propose
```

Will result in a comment response with instructions to create an on-chain referendum.

2. Process

After the RFC referendum was confirmed, it processes the Pull Request (by merging or closing it).

```
/rfc process <block hash of when the referendum was confirmed>
```

If you're not sure where to get this block hash,
send a `/rfc process` command and the action will respond with more instructions.

## Configuration

To use the action in a repository, add a job that is going to run on specific comments on PRs:

```yaml
name: RFC action

on:
  issue_comment:
    types: [created]

permissions:
  pull-requests: write
  contents: write

jobs:
  rfc-action:
    name: Handle an RFC-relate command in a RFC proposal PR
    if: ${{ github.event.issue.pull_request && startsWith(github.event.comment.body, '/rfc') }}
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: paritytech/rfc-action@main
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      PROVIDER_URL: "wss://polkadot-collectives-rpc.polkadot.io" # Optional.

```

### Environment variables

The action uses the `GH_TOKEN` environment variable supplied to it.

The built-in `secrets.GITHUB_TOKEN` can be used, as long as it has the necessary permissions.

- `pull-requests: write` permission is used to write comments in the PR.
- `contents: write` permission is used to close/merge the PR.

The `PROVIDER_URL` variable can be specified to override the default public endpoint to the Collectives parachain.

A full archive node is needed to process the confirmed referenda.

## Notification job

You can set the GitHub action to also run notifying on a PR when a referenda is available for voting.

It will look for new referendas available since the last time the action was run, so it won't generate duplicated messages.

```yml
on:
  workflow_dispatch:
  schedule:
    - cron: '0 12 * * *'

jobs:
  notify_referendas:
    runs-on: ubuntu-latest
    steps:
      - name: Get last run
        run: |
          last=$(gh run list -w "$WORKFLOW" --json startedAt,status -q 'map(select(.status == "completed"))[0].startedAt')
          echo "last=$last" >> "$GITHUB_OUTPUT"
        id: date
        env: 
          GH_TOKEN: ${{ github.token }}
          WORKFLOW: ${{ github.workflow }}
          GH_REPO: "${{ github.repository_owner }}/${{ github.event.repository.name }}"
      - uses: paritytech/rfc-action@main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PROVIDER_URL: "wss://polkadot-collectives-rpc.polkadot.io" # Optional.
          START_DATE: ${{ steps.date.outputs.last }}
```
