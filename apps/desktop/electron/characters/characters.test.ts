import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import { castOf, characterImage, charactersDir, personaOf } from './characters'
import { chosenShift, rememberShift } from '../history/history'

let root: string
let previousXdg: string | undefined
beforeEach(() => {
  previousXdg = process.env.XDG_CONFIG_HOME
  const config = fs.mkdtempSync(path.join(os.tmpdir(), 'cafe-characters-'))
  process.env.XDG_CONFIG_HOME = config
  root = path.join(config, 'claudecafe', 'characters')
  fs.mkdirSync(root, { recursive: true })
  fs.rmSync(path.join(app.getPath('userData'), 'shift.json'), { force: true })
})
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
  if (previousXdg === undefined) delete process.env.XDG_CONFIG_HOME
  else process.env.XDG_CONFIG_HOME = previousXdg
  fs.rmSync(path.dirname(path.dirname(root)), { recursive: true, force: true })
  fs.rmSync(path.join(app.getPath('userData'), 'shift.json'), { force: true })
})

function addMaid(id: string, name: string) {
  const folder = path.join(root, id)
  fs.mkdirSync(path.join(folder, 'portraits'), { recursive: true })
  fs.writeFileSync(path.join(folder, 'persona.md'), `---\nname: "${name}"\n---\nPersona for ${name}`)
  fs.writeFileSync(path.join(folder, 'portraits/neutral.webp'), 'image')
  return folder
}

describe('runtime characters', () => {
  it('looks beside the café settings for characters', () => {
    expect(charactersDir()).toBe(root)
    expect(castOf()).toEqual([])
    expect(chosenShift()).toEqual({ maid: '' })
  })

  it('discovers arbitrary folder names and reads their own personas and artwork', () => {
    const folder = addMaid('new-maid', 'New Maid')
    fs.writeFileSync(path.join(folder, 'portraits/happy.webp'), 'happy')
    fs.writeFileSync(path.join(folder, 'avatar.webp'), 'avatar')
    const cast = castOf()
    expect(cast).toHaveLength(1)
    expect(cast[0]).toMatchObject({ id: 'new-maid', name: 'New Maid' })
    expect(characterImage(cast[0].avatar)).toBe(fs.realpathSync(path.join(folder, 'avatar.webp')))
    expect(characterImage(cast[0].expressions.happy)).toBe(fs.realpathSync(path.join(folder, 'portraits/happy.webp')))
    expect(personaOf('new-maid')).toBe('Persona for New Maid')
    expect(chosenShift()).toEqual({ maid: 'new-maid' })
    expect(cast[0]).not.toHaveProperty('outfits')
  })

  it('inherits the name, persona and artwork of the maid a persona extends', () => {
    const parent = addMaid('kokona', 'Kokona')
    fs.writeFileSync(path.join(parent, 'portraits/happy.webp'), 'happy')
    fs.writeFileSync(path.join(parent, 'avatar.webp'), 'avatar')
    fs.mkdirSync(path.join(root, 'kokona-zh'))
    fs.writeFileSync(path.join(root, 'kokona-zh/persona.md'), '---\nextends: kokona\n---\n')
    const child = castOf().find((maid) => maid.id === 'kokona-zh')!
    expect(child.name).toBe('Kokona')
    expect(personaOf('kokona-zh')).toBe('Persona for Kokona')
    expect(characterImage(child.avatar)).toBe(fs.realpathSync(path.join(parent, 'avatar.webp')))
    expect(characterImage(child.expressions.happy)).toBe(fs.realpathSync(path.join(parent, 'portraits/happy.webp')))
  })

  it('lets an extending persona override fields, body and the whole portrait folder', () => {
    const parent = addMaid('kokona', 'Kokona')
    fs.writeFileSync(path.join(parent, 'portraits/happy.webp'), 'happy')
    const child = addMaid('kokona-zh', 'ここな')
    fs.writeFileSync(path.join(child, 'persona.md'), '---\nextends: kokona\nname: "ここな"\n---\n中文人格')
    const maid = castOf().find((entry) => entry.id === 'kokona-zh')!
    expect(maid.name).toBe('ここな')
    expect(personaOf('kokona-zh')).toBe('中文人格')
    expect(Object.keys(maid.expressions)).toEqual(['neutral'])
    expect(characterImage(maid.avatar)).toBe(fs.realpathSync(path.join(child, 'portraits/neutral.webp')))
  })

  it('stops at a cycle or a missing parent instead of looping', () => {
    const one = addMaid('one', 'One')
    fs.writeFileSync(path.join(one, 'persona.md'), '---\nname: One\nextends: two\n---\nOne body')
    fs.mkdirSync(path.join(root, 'two'))
    fs.writeFileSync(path.join(root, 'two/persona.md'), '---\nextends: one\n---\n')
    const lost = addMaid('lost', 'Lost')
    fs.writeFileSync(path.join(lost, 'persona.md'), '---\nname: Lost\nextends: nobody\n---\nLost body')
    expect(castOf().map((maid) => [maid.id, maid.name])).toEqual([['lost', 'Lost'], ['one', 'One'], ['two', 'One']])
    expect(personaOf('two')).toBe('One body')
    expect(personaOf('lost')).toBe('Lost body')
  })

  it('keeps Kotone as the initial shift when the other published maids are installed', () => {
    addMaid('kokona', 'Kokona')
    addMaid('kotone', 'Kotone')
    addMaid('kurumi', 'Kurumi')
    expect(chosenShift()).toEqual({ maid: 'kotone' })
  })

  it('skips incomplete character folders and falls back from a removed saved maid', () => {
    addMaid('zeta', 'Zeta')
    const incomplete = addMaid('alpha', 'Alpha')
    fs.unlinkSync(path.join(incomplete, 'portraits/neutral.webp'))
    rememberShift({ maid: 'removed' })
    expect(castOf().map((maid) => maid.id)).toEqual(['zeta'])
    expect(chosenShift()).toEqual({ maid: 'zeta' })
    expect(characterImage(castOf()[0].avatar)).toBe(fs.realpathSync(path.join(root, 'zeta/portraits/neutral.webp')))
  })

  it('does not reuse image URLs when another folder contains the same maid', () => {
    addMaid('maid', 'Maid')
    const nested = path.join(root, 'another')
    fs.mkdirSync(nested)
    fs.cpSync(path.join(root, 'maid'), path.join(nested, 'maid'), { recursive: true })
    expect(castOf(root)[0].avatar).not.toBe(castOf(nested)[0].avatar)
  })

  it('rejects traversal, non-artwork paths and symlinks outside the configured directory', () => {
    const folder = addMaid('maid', 'Maid')
    fs.symlinkSync(path.join(app.getPath('userData'), 'shift.json'), path.join(folder, 'portraits/escape.webp'))
    expect(characterImage('cafe-character://cast/maid/portraits/escape.webp')).toBeNull()
    expect(characterImage('cafe-character://cast/maid/persona.md')).toBeNull()
    expect(characterImage('cafe-character://cast/maid/portraits/%2e%2e%2fshift.json')).toBeNull()
    expect(personaOf('../maid')).toBe('')
  })
})
