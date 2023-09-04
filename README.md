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

## Configuration

To use the action in a repository, add a job that is going to run on specific comments on PRs:

```yaml
name: RFC propose

on:
  issue_comment:
    types: [created]

permissions:
  pull-requests: write

jobs:
  rfc-propose:
    name: Propose an RFC creation transaction
    if: ${{ github.event.issue.pull_request && startsWith(github.event.comment.body, '/rfc') }}
    runs-on: ubuntu-latest
    steps:
      - uses: paritytech/rfc-action@main
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

```

### Environment variables

The action uses the `GH_TOKEN` environment variable supplied to it.

The built-in `secrets.GITHUB_TOKEN` can be used, as long as it has the `pull-requests` write permissions.
