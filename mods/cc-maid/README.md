# cc-maid

![A pixel-art maid changing expressions beside Claude Code](../../docs/images/cc-maid.gif)

A pixel-art maid who stands in a panel beside your Claude Code conversation and
changes her expression as she works: focused when she starts, curious while she
investigates, happy when the tests pass, sorry when she slips up. Claude picks the
face itself; you don't have to ask.

The current artwork is Kotone, with 26 expressions. cc-maid only supplies the
portrait. How Claude talks stays with whatever persona you already use, such as
the `cafe` plugin from the same marketplace.

> Experimental. cc-maid is built on Claude Code's function hooks, which are in
> early access and may change between releases.

## Install

Inside Claude Code:

```
/plugin marketplace add https://claudecafe.dev/plugins/marketplace.json
/plugin install cc-maid@claudecafe
```

Then start Claude Code with function hooks enabled:

```sh
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude
```

The panel opens when an interactive terminal session starts. It does not appear
in non-interactive runs (`claude -p`) or on desktop and mobile.

## Use

Just work as usual. Claude changes the portrait when its tone changes, and the
face stays until the next change.

You can also ask for a face directly, for example "switch to happy". The
expressions are:

`neutral` `happy` `angry` `sad` `afraid` `awkward` `confused` `curious`
`disgusted` `embarrassed` `flirty` `focused` `frustrated` `horny` `impressed`
`pouty` `proud` `relieved` `skeptical` `smug` `sorry` `speechless` `surprised`
`thinking` `wink` `worried`

A text mood marker such as the `【 … 】` line that `cafe` personas end replies
with does not change the panel; only Claude's expression tool does.

## Update

```
/plugin marketplace update claudecafe
/plugin update cc-maid@claudecafe
```
