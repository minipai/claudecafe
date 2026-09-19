/** @jsxImportSource @opentui/solid */
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { NativeImage } from "@opentui/core"
import { Plugin } from "@opencode/plugin/tui"
import { createEffect, createSignal, onCleanup } from "solid-js"
import { EXPRESSIONS, type Expression } from "./expressions.ts"
import { cafeRpc } from "./rpc.ts"

type SetExpression = (value: Expression) => Promise<void>
type Context = Plugin.Context

const charactersRoot = dirname(createRequire(import.meta.url).resolve("@claudecafe/characters/package.json"))
// The sidebar's inner width is normally 38 cells. Keep a small horizontal
// inset while the image itself uses its native pixel dimensions.
const IMAGE_ROWS = 28
const IMAGE_COLS = 36

function portraitPath(expression: Expression): string {
  return join(charactersRoot, "kotone", "expressions", "uniform", `${expression}.webp`)
}

function MaidCard(props: {
  api: Context
  expression: () => Expression
}) {
  const [image, setImage] = createSignal<NativeImage>()
  const [failed, setFailed] = createSignal(false)
  let current: NativeImage | undefined
  let generation = 0

  createEffect(() => {
    const expression = props.expression()
    const expected = ++generation
    setFailed(false)
    void NativeImage.load(portraitPath(expression))
      .then((source) => {
        if (expected !== generation) {
          source.dispose()
          return
        }
        const previous = current
        current = source
        setImage(source)
        previous?.dispose()
        props.api.renderer.requestRender()
      })
      .catch(() => {
        if (expected !== generation) return
        const previous = current
        current = undefined
        setImage(undefined)
        setFailed(true)
        previous?.dispose()
        props.api.renderer.requestRender()
      })
  })

  onCleanup(() => {
    generation++
    current?.dispose()
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
        {image() ? (
          <image source={image()!} {...nativeCellSize(props.api, image()!)} flexShrink={0} fit="fill" />
        ) : (
          <text fg={props.api.theme.text.subdued}>{failed() ? "Portrait unavailable" : "Loading portrait..."}</text>
        )}
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

function nativeCellSize(api: Context, image: NativeImage): { width: number; height: number } {
  const resolution = api.renderer.resolution
  if (!resolution) {
    return {
      width: IMAGE_COLS,
      height: Math.round((IMAGE_COLS * image.height) / (image.width * 2)),
    }
  }

  const cellWidth = resolution.width / api.renderer.terminalWidth
  const cellHeight = resolution.height / api.renderer.terminalHeight
  return {
    width: Math.max(1, Math.round(image.width / cellWidth)),
    height: Math.max(1, Math.round(image.height / cellHeight)),
  }
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
