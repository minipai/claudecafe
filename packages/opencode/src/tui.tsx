/** @jsxImportSource @opentui/solid */
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import type { TextRenderable } from "@opentui/core"
import { Plugin } from "@opencode/plugin/tui"
import { createEffect, createMemo } from "solid-js"
import { EXPRESSIONS, type Expression } from "./expressions.ts"
import { loadFaces, renderFace } from "./faces.ts"
import { cafeRpc } from "./rpc.ts"

type SetExpression = (value: Expression) => Promise<void>
type Context = Plugin.Context

const charactersRoot = dirname(createRequire(import.meta.url).resolve("@claudecafe/characters/package.json"))
// The sidebar's inner width is normally 38 cells; its own padding supplies the inset.
const IMAGE_ROWS = 25
const IMAGE_COLS = 38
const IMAGE_TOP = 24
const faces = loadFaces(join(charactersRoot, "kotone", "expressions", "uniform", "panel.faces"))

function MaidCard(props: {
  api: Context
  expression: () => Expression
}) {
  const portrait = createMemo(() => renderFace(faces[props.expression()]!, IMAGE_COLS, IMAGE_ROWS, IMAGE_TOP))
  let portraitNode: TextRenderable | undefined

  createEffect(() => {
    const content = portrait()
    if (portraitNode) portraitNode.content = content
  })

  return (
    <box flexDirection="column" flexShrink={0}>
      <box
        width="100%"
        height={IMAGE_ROWS}
        flexShrink={0}
        alignItems="center"
        justifyContent="flex-start"
        overflow="hidden"
        backgroundColor={props.api.theme.background.raised.base}
      >
        <text
          ref={(node) => {
            portraitNode = node
            node.content = portrait()
          }}
          width={IMAGE_COLS}
          height={IMAGE_ROWS}
          flexShrink={0}
          wrapMode="none"
          selectable={false}
        />
      </box>
      <box
        width="100%"
        flexShrink={0}
        flexDirection="row"
        justifyContent="center"
        border
        borderStyle="rounded"
        borderColor={props.api.theme.border.default}
      >
        <text fg={props.api.theme.text.default}>
          <b>ことね</b>
          <span style={{ fg: props.api.theme.text.subdued }}> {props.expression()}</span>
        </text>
      </box>
    </box>
  )
}

function MaidCommands(props: {
  api: Context
  expression: () => Expression
  setExpression: SetExpression
}) {
  const { api, expression, setExpression } = props
  api.keymap.layer(() => ({
    commands: [
      {
        id: "maid.expression",
        title: "Maid expression",
        group: "Maid",
        palette: true,
        slash: { name: "maid" },
        async run() {
          const value = await api.ui.dialog.select({
            title: "Maid expression",
            current: expression(),
            options: EXPRESSIONS.map((item) => ({ title: item, value: item })),
          })
          if (value) await setExpression(value)
        },
      },
    ],
  }))
  return null
}

export default Plugin.define({
  id: "claudecafe.maid",
  async setup(api) {
    const [look, setLook] = api.storage.store<{ value: Expression }>("expression", {
      initial: { value: "neutral" },
    })
    const expression = () => look.value
    const setExpression: SetExpression = async (value) => {
      await setLook((draft) => {
        draft.value = value
      })
      api.renderer.requestRender()
    }
    const rpc = api.client.rpc(cafeRpc)
    const stopExpressionEvents = rpc.events.on("expression", (event) => setExpression(event.data.expression))

    try {
      const current = await rpc.expression({})
      await setExpression(current.expression)
    } catch {
      // The portrait still works when connected to a server without the café.
    }

    const removeCommands = api.ui.slot({
      append: "app",
      render: () => <MaidCommands api={api} expression={expression} setExpression={setExpression} />,
    })
    const removePortrait = api.ui.slot({
      append: "sidebar.footer",
      render: () => <MaidCard api={api} expression={expression} />,
    })

    return () => {
      stopExpressionEvents()
      removeCommands()
      removePortrait()
    }
  },
})
