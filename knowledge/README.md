# Gaming Zone chatbot knowledge files

This folder contains Markdown guides for the five games listed on the Gaming Zone website, plus shared response guidelines.

## Files
- `number-tapping.md`
- `number-quest.md`
- `glow-runner.md`
- `neon-velocity-3d.md`
- `brick-dash.md`
- `chatbot-guidelines.md`

## Important accuracy note
The Number Tapping guide includes the mechanics documented in the project conversation: a target number, shuffled 3×3 grid, and a shrinking time window. For the other four games, only the game names are confirmed here; their exact mechanics need to be checked against the current game UI/source and filled in before the chatbot makes specific claims.

## Suggested website structure
Place these files in the website's published directory:

```text
knowledge/
  number-tapping.md
  number-quest.md
  glow-runner.md
  neon-velocity-3d.md
  brick-dash.md
  chatbot-guidelines.md
```

Make sure the URLs are publicly accessible after GitHub Pages deploys. The frontend must fetch the files and implement retrieval; simply adding Markdown files does not create an AI chatbot by itself.
