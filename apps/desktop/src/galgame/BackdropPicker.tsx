import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { fill, text } from '@/i18n'
import type { Backdrop } from '@/agent'
import { EDGES, SCENES, paintBackdrop } from './backdrops'

/**
 * Choosing what she stands in front of.
 *
 * It sits where the dialogue box sits, along the bottom edge, because the thing
 * being chosen is the top two thirds of the window — a picker in the middle of
 * the screen covers up the only thing worth looking at while picking. Every
 * choice takes effect the moment it is clicked and the picker stays open, so
 * this is somewhere to look through the options rather than to commit to one.
 *
 * The edges are previewed on the room that is actually up: the same edge reads
 * quite differently over a bright sky and over a dark shrine at dusk, and a
 * swatch of the shape alone would not say so.
 */
export function BackdropPicker({
  chosen,
  onChoose,
  onClose,
}: {
  chosen: Backdrop
  onChoose: (chosen: Backdrop) => void
  onClose: () => void
}) {
  const t = text()

  return (
    <div className="relative w-full rounded-xl border border-border bg-card p-4 shadow-md">
      <button
        type="button"
        onClick={onClose}
        aria-label={fill(t.panel.close, { what: t.bar.backdrop })}
        className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <Row heading={t.bar.backdrop}>
        {SCENES.map((scene) => (
          <Swatch
            key={scene.id}
            label={named(t.backdrop.scene, scene.id)}
            picked={scene.id === chosen.scene}
            // Each room is shown wearing the edge that is currently set, so the
            // row answers "what would this look like" rather than "what is in
            // the file".
            paint={[scene.id, chosen.edge]}
            onPick={() => onChoose({ ...chosen, scene: scene.id })}
          />
        ))}
      </Row>

      <div className="mt-3 border-t border-border pt-3">
        <Row heading={t.bar.edge}>
          {EDGES.map((edge) => (
            <Swatch
              key={edge.id}
              label={named(t.backdrop.edge, edge.id)}
              picked={edge.id === chosen.edge}
              paint={[chosen.scene, edge.id]}
              onPick={() => onChoose({ ...chosen, edge: edge.id })}
            />
          ))}
        </Row>
      </div>
    </div>
  )
}

function Row({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{heading}</p>
      {/* Scrolls sideways rather than wrapping: the row is a strip of pictures,
          and a second line of them would push the picker over her face. */}
      <div className="flex gap-2 overflow-x-auto pb-1">{children}</div>
    </div>
  )
}

/** One option, drawn as what it would actually look like. */
function Swatch({
  label,
  picked,
  paint,
  onPick,
}: {
  label: string
  picked: boolean
  paint: [string, string]
  onPick: () => void
}) {
  const preview = usePreview(paint[0], paint[1])

  return (
    <button
      type="button"
      onClick={onPick}
      title={label}
      className={`group flex w-[84px] shrink-0 flex-col gap-1 rounded-lg border p-1 text-left transition-colors ${
        picked ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-muted'
      }`}
    >
      {/* The chequer shows through wherever the edge has cut the picture away,
          which is the whole point of the choice being made — over the desktop
          those parts are not white, they are whatever is behind the window. */}
      <span className="relative block h-[70px] w-full overflow-hidden rounded-md bg-[repeating-conic-gradient(rgba(128,128,128,0.2)_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
        {preview && <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />}
      </span>
      <span className="truncate text-[11px] leading-tight text-muted-foreground group-hover:text-foreground">
        {label}
      </span>
    </button>
  )
}

/** The thumbnail for one combination. Painted small, and dropped if the choice
 * moves on before it lands. */
function usePreview(scene: string, edge: string) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void paintBackdrop(scene, edge, PREVIEW)
      .catch(() => null)
      .then((url) => {
        if (current) setPreview(url)
      })
    return () => {
      current = false
    }
  }, [scene, edge])

  return preview
}

/** A swatch, at the window's own proportions so that what it shows is what
 * will happen. Wide enough for a retina screen and no wider — a dozen of these
 * are painted every time the picker opens. */
const PREVIEW = { width: 216, height: 180 }

/** The wording for one of the names. Written out key by key, so a room or an
 * edge added ahead of the translations falls back to its own id. */
function named(table: Record<string, string>, id: string) {
  return table[id] ?? id
}
