# Fellowship Process Bot

## Example usage

- Create a `.github/workflows/process.yml` GH action workflow

```yml
name: Process Bot
on:
  issue_comment:
    types: [created] # only trigger on new issue comments
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} # authorize bot
  GH_PAT: ${{ secrets.GH_PAT }} # authorize bot to write to PRs
jobs:
  process:
    name: Process Comment
    # only run if the comment is on a PR and starts with /bot
    if: ${{ github.event.issue.pull_request && startsWith(github.event.comment.body, '/bot ') }}
    runs-on: ubuntu-latest
    steps:
      - uses: xlc/fellowship-process-bot@main

```

- Create PAT token with read and write permission for pull requests and contents.
- Provide the PAT token to the GH action with repo secrets `GH_PAT`
