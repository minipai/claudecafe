/** @jsxImportSource @opentui/solid */
import { StyledText, type TextRenderable } from "@opentui/core"
import { Plugin } from "@opencode/plugin/tui"
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { availableCharacters, characterForMaid } from "./cafe.ts"
import { defaultFace, type Expression } from "./expressions.ts"
import { FACE_COLUMNS, FACE_ROWS, loadFaces, renderFace, type Face } from "./faces.ts"
import { cafeRpc } from "./rpc.ts"

type SetExpression = (sessionID: string, value: Expression) => Promise<void>
type Context = Plugin.Context

type FaceBundle = {
  faces: Record<string, Face>
  names: string[]
  fallback: string
}

const IMAGE_ROWS = FACE_ROWS / 2
const faceBundles = new Map<string, FaceBundle | null>()

function faceBundle(maid: string | null): FaceBundle | null {
  if (!maid) return null
  if (!faceBundles.has(maid)) {
    const character = characterForMaid(maid)
    if (!character?.pixelsDir) {
      faceBundles.set(maid, null)
    } else {
      const faces = loadFaces(character.pixelsDir)
      const names = Object.keys(faces)
      faceBundles.set(maid, names.length ? { faces, names, fallback: defaultFace(names) } : null)
    }
  }
  return faceBundles.get(maid) ?? null
}

function storedExpression(value: unknown): { maid?: unknown; face?: unknown } {
  return typeof value === "object" && value !== null ? (value as { maid?: unknown; face?: unknown }) : {}
}

function MaidCard(props: {
  api: Context
  sessionID: string
  expression: () => Expression
  sync: (sessionID: string) => void
}) {
  const [frameIndex, setFrameIndex] = createSignal(0)
  const character = createMemo(() => {
    const maid = props.expression().maid
    return maid ? characterForMaid(maid) : null
  })
  const bundle = createMemo(() => faceBundle(character()?.id ?? null))
  const face = createMemo(() => {
    const loaded = bundle()
    return loaded?.faces[props.expression().face] ?? (loaded ? loaded.faces[loaded.fallback] : undefined)
  })
  const portrait = createMemo(() => {
    const selected = face()
    return selected ? renderFace(selected, frameIndex()) : new StyledText([])
  })
  let portraitNode: TextRenderable | undefined

  createEffect(() => props.sync(props.sessionID))

  createEffect(() => {
    const selected = face()
    let index = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    setFrameIndex(0)
    if (!selected) return

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
          <b>{character()?.name ?? "Maid"}</b>
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
  selectMaid: (sessionID: string, maid: string) => Promise<void>
}) {
  const { api, expression, setExpression, selectMaid } = props
  api.keymap.layer(() => ({
    commands: [
      {
        id: "maid.character",
        title: "Choose maid",
        group: "Maid",
        palette: true,
        slash: { name: "maid" },
        async run() {
          const sessionID = currentSession(api)
          if (!sessionID) return
          const current = expression(sessionID)
          const options = availableCharacters().map((character) => ({
            title: `${character.name} (${character.id})`,
            value: character.id,
          }))
          options.unshift({ title: "No maid", value: "none" })
          const value = await api.ui.dialog.select({
            title: "Choose maid",
            current: current.maid ?? undefined,
            options,
          })
          if (value) await selectMaid(sessionID, value)
        },
      },
      {
        id: "maid.expression",
        title: "Maid face",
        group: "Maid",
        palette: true,
        slash: { name: "face" },
        async run() {
          const sessionID = currentSession(api)
          if (!sessionID) return
          const current = expression(sessionID)
          const bundle = faceBundle(current.maid)
          const value = await api.ui.dialog.select({
            title: "Maid face",
            current: current.face,
            options: (bundle?.names ?? []).map((item) => ({ title: item, value: item })),
          })
          if (value) await setExpression(sessionID, { maid: current.maid, face: value })
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
      const look = storedExpression(looks[sessionID])
      const maid = typeof look.maid === "string" ? look.maid : null
      const bundle = faceBundle(maid)
      const face = typeof look.face === "string" && bundle?.faces[look.face] ? look.face : bundle?.fallback ?? "neutral"
      return { maid, face }
    }
    const setExpression: SetExpression = async (sessionID, value) => {
      await setLooks((draft) => {
        draft[sessionID] = { maid: value.maid, face: value.face }
      })
      api.renderer.requestRender()
    }
    const rpc = api.client.rpc(cafeRpc)
    const selectMaid = async (sessionID: string, maid: string): Promise<void> => {
      const value = await rpc.selectMaid({ sessionID, maid })
      await setExpression(sessionID, value)
    }
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
      render: () => (
        <MaidCommands
          api={api}
          expression={expression}
          setExpression={setExpression}
          selectMaid={selectMaid}
        />
      ),
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
