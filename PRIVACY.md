# persona-panel privacy note

Last updated 2026-09-26.

persona-panel is a Claude Code plugin. It collects nothing for its authors: no
analytics, no telemetry, no account, and no server of ours receives anything
from it.

## On your machine

- It reads `config.json` and the character folders under
  `~/.config/claudecafe/` (or `$XDG_CONFIG_HOME/claudecafe/`), and its own
  bundled files.
- It writes one small file per session,
  `~/.config/claudecafe/sessions/<session id>/character`, holding the id of the
  character drawn for that session.
- It runs two local Git commands in your project — `git log --oneline
  --since=midnight` and `git branch --show-current` — only to show today's
  commit count and the current branch.

## Over the network

- Once per session it asks [wttr.in](https://wttr.in), a third-party weather
  service, for the local weather. The request carries none of your data, but
  wttr.in sees your IP address and uses it to estimate your location. Set
  `"greeting": false` in `config.json` to turn this off.
- Installing or updating the plugin fetches it from claudecafe.dev or GitHub,
  which see your IP address like any website.

## In the conversation

The persona, the greeting, the time and weather line and the mood-marker cue
are added to Claude's context. Like the rest of your conversation, that context
goes to the model provider your Claude Code uses, under that provider's terms.

## Contact

Questions: open an issue at
[github.com/minipai/claudecafe/issues](https://github.com/minipai/claudecafe/issues).
