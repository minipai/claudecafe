// One list for both faces of the café: the server registers the tool with it
// and the panel keys its artwork off it. The order also drives the /maid picker.

export const EXPRESSIONS = [
  "neutral",
  "happy",
  "angry",
  "sad",
  "afraid",
  "awkward",
  "confused",
  "curious",
  "disgusted",
  "embarrassed",
  "flirty",
  "focused",
  "frustrated",
  "horny",
  "impressed",
  "pouty",
  "proud",
  "relieved",
  "skeptical",
  "smug",
  "sorry",
  "speechless",
  "surprised",
  "thinking",
  "wink",
  "worried",
] as const

export type Expression = (typeof EXPRESSIONS)[number]

// Mirrors cc-maid's set_expression, so the same persona guidance holds in both
// hosts: the tool moves the real panel, the text mood marker does not.
export const expressionToolDescription =
  "Change your visible portrait in the Café panel to match your current emotion. " +
  "Use when your emotional tone changes or the user asks for an expression; do not call on every reply or repeat the current expression. " +
  "The portrait stays until changed. neutral is calm; happy is smiling with closed eyes; " +
  "flirty blows a kiss; impressed is delighted amazement; surprised is shock; wink is a playful wink. " +
  "This changes the actual panel image, independently of the text mood marker."

export const expressionPrompt = `The user can see your character standing in a panel beside this terminal conversation. Treat the panel as your visible expression: let your face keep up with what you are saying and doing.

- Call set_expression when your mood changes, without waiting to be asked. For example: thinking while working something out, focused when starting the work, curious while investigating, happy when it succeeds, impressed when the user beats you to it, and sorry when you make a mistake.
- Change your expression before the reply or work it accompanies. Keep it natural: one change for a meaningful shift, not a call on every message or repeated calls for the same face. The selected face stays until the next call.
- Choose the expression that fits your actual tone. flirty is a playful blowing kiss; wink is a wink. Use these only when the conversation suits them.
- The tool changes the real panel image. A written mood marker or saying that you changed your face does not change it. If a persona asks for mood markers, keep following that instruction and let the panel match the mood.
- Do not narrate routine expression changes. Continue the user's task normally; this panel adds a visible reaction and does not require shorter replies, roleplay, or a different persona.`
