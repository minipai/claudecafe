import { X } from 'lucide-react'
import type { Attachment } from '@/agent'

/** An image on its way to her, with the thumbnail it will be seen as. */
export type Pending = Attachment & { id: number; preview: string }

let pendingId = 0

/** Read a picture the master handed over — off the clipboard or off the desk —
 * into the base64 the SDK takes, keeping a thumbnail of it for the composer. */
export async function readImage(file: File): Promise<Pending> {
  const buffer = await file.arrayBuffer()
  let binary = ''
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte)
  const data = btoa(binary)
  return {
    id: pendingId++,
    mediaType: file.type,
    data,
    preview: `data:${file.type};base64,${data}`,
  }
}

/** The pictures waiting above the input, each one droppable again. */
export function Attachments({
  pending,
  onRemove,
}: {
  pending: Pending[]
  onRemove: (id: number) => void
}) {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {pending.map((image) => (
        <div key={image.id} className="group relative">
          <img
            src={image.preview}
            alt=""
            className="h-14 w-14 rounded-md border border-border object-cover"
          />
          <button
            type="button"
            aria-label="Remove image"
            onClick={() => onRemove(image.id)}
            className="absolute -top-1.5 -right-1.5 rounded-full border border-border bg-card p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
