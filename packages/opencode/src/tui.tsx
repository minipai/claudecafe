/** @jsxImportSource @opentui/solid */
import type { TextRenderable } from "@opentui/core"
import { Plugin } from "@opencode/plugin/tui"
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { defaultFace, FACE_DIRECTORY, type Expression } from "./expressions.ts"
import { FACE_COLUMNS, FACE_ROWS, loadFaces, renderFace } from "./faces.ts"
import { cafeRpc } from "./rpc.ts"

type SetExpression = (sessionID: string, value: Expression) => Promise<void>
type Context = Plugin.Context

// The sidebar's inner width is normally 38 cells: 36 for the portrait and two for its frame.
const IMAGE_ROWS = FACE_ROWS / 2
const faces = loadFaces(FACE_DIRECTORY)
const faceNames = Object.keys(faces)
const fallbackFace = defaultFace(faceNames)

function storedFace(value: unknown): { face?: unknown } {
  return typeof value === "object" && value !== null ? (value as { face?: unknown }) : {}
}

function MaidCard(props: {
  api: Context
  sessionID: string
  expression: () => Expression
  sync: (sessionID: string) => void
}) {
  const [frameIndex, setFrameIndex] = createSignal(0)
  const face = createMemo(() => faces[props.expression().face] ?? faces[fallbackFace]!)
  const portrait = createMemo(() => renderFace(face(), frameIndex()))
  let portraitNode: TextRenderable | undefined

  createEffect(() => props.sync(props.sessionID))

  createEffect(() => {
    const selected = face()
    let index = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    setFrameIndex(0)

    const advance = () => {
      index = (index + 1) % selected.frames.length
      setFrameIndex(index)
      props.api.renderer.requestRender()
      timer = setTimeout(advance, selected.frames[index]!.delay)
    }
    if (selected.frames.length > 1) timer = setTimeout(advance, selected.frames[0]!.delay)
    onCleanup(() => {
      if (timer) clearTimeout(timer)
    })
  })

  createEffect(() => {
    const content = portrait()
    if (portraitNode) portraitNode.content = content
  })

  return (
    <box
      width="100%"
      flexDirection="column"
      flexShrink={0}
      backgroundColor={props.api.theme.background.raised.base}
      border
      borderStyle="rounded"
      borderColor={props.api.theme.border.default}
    >
      <box
        width="100%"
        height={IMAGE_ROWS}
        flexShrink={0}
        alignItems="center"
        justifyContent="flex-start"
        overflow="hidden"
      >
        <text
          ref={(node) => {
            portraitNode = node
            node.content = portrait()
          }}
          width={FACE_COLUMNS}
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
        border={["top"]}
        borderStyle="single"
        borderColor={props.api.theme.border.default}
        overflow="hidden"
      >
        <text fg={props.api.theme.text.default} wrapMode="none">
          <b>ことね</b>
          <span style={{ fg: props.api.theme.text.subdued }}> · {props.expression().face}</span>
        </text>
      </box>
    </box>
  )
}

function MaidCommands(props: {
  api: Context
  expression: (sessionID: string) => Expression
  setExpression: SetExpression
}) {
  const { api, expression, setExpression } = props
  api.keymap.layer(() => ({
    commands: [
      {
        id: "maid.expression",
        title: "Maid face",
        group: "Maid",
        palette: true,
        slash: { name: "maid" },
        async run() {
          const sessionID = currentSession(api)
          if (!sessionID) return
          const value = await api.ui.dialog.select({
            title: "Maid face",
            current: expression(sessionID).face,
            options: faceNames.map((item) => ({ title: item, value: item })),
          })
          if (value) await setExpression(sessionID, { ...expression(sessionID), face: value })
        },
      },
    ],
  }))
  return null
}

/** The portrait belongs to the session in view; the active tab is the fallback. */
function currentSession(api: Context): string | undefined {
  const route = api.ui.router.current()
  if (route.type === "session") return route.sessionID
  return api.ui.tabs.list().find((tab) => tab.active)?.sessionID
}

export default Plugin.define({
  id: "claudecafe.maid",
  async setup(api) {
    const [looks, setLooks] = api.storage.store<Record<string, unknown>>("expressions", { initial: {} })
    const expression = (sessionID: string): Expression => {
      const look = storedFace(looks[sessionID])
      return {
        face: typeof look.face === "string" && faces[look.face] ? look.face : fallbackFace,
      }
    }
    const setExpression: SetExpression = async (sessionID, value) => {
      await setLooks((draft) => {
        draft[sessionID] = { face: value.face }
      })
      api.renderer.requestRender()
    }
    const rpc = api.client.rpc(cafeRpc)
    const stopExpressionEvents = rpc.events.on("expression", (event) => {
      const { sessionID, ...value } = event.data
      void setExpression(sessionID, value)
    })
    const synced = new Set<string>()
    const syncExpression = (sessionID: string): void => {
      if (synced.has(sessionID)) return
      synced.add(sessionID)
      void rpc
        .expression({ sessionID })
        .then((current) => setExpression(sessionID, current))
        .catch(() => {
          // The portrait still works when connected to a server without the café.
        })
    }

    const removeCommands = api.ui.slot({
      append: "app",
      render: () => <MaidCommands api={api} expression={expression} setExpression={setExpression} />,
    })
    const removePortrait = api.ui.slot({
      append: "sidebar.footer",
      render: (input) => (
        <MaidCard
          api={api}
          sessionID={input.sessionID}
          expression={() => expression(input.sessionID)}
          sync={syncExpression}
        />
      ),
    })

    return () => {
      stopExpressionEvents()
      removeCommands()
      removePortrait()
    }
  },
})
