/**
 * The character packs published for each maid, pinned by version and SHA-256. Every host that installs packs into
 * the café data root (the desktop app, OpenCode, the Claude Code plugin) reads this one list, so a release updates
 * one place: `scripts/ship-characters.sh` prints the new URL and digest.
 */
export const PUBLISHED_CHARACTER_PACKS = [
  {
    id: "kotone",
    version: "1.4.0",
    url: "https://github.com/minipai/claudecafe/releases/download/kotone-characters-v1.4.0/ClaudeCafe-Kotone-characters-v1.4.0.zip",
    sha256: "7a0d8d9b7e52104feaff94be2745ad4179367325b2eb69432b94fc689a29f041",
  },
  {
    id: "kurumi",
    version: "1.4.0",
    url: "https://github.com/minipai/claudecafe/releases/download/kurumi-characters-v1.4.0/ClaudeCafe-Kurumi-characters-v1.4.0.zip",
    sha256: "1f028c4189a0e605517d85089a19f8662789c1f8068ccdb9dba6069b6b8aa17b",
  },
  {
    id: "kokona",
    version: "1.4.0",
    url: "https://github.com/minipai/claudecafe/releases/download/kokona-characters-v1.4.0/ClaudeCafe-Kokona-characters-v1.4.0.zip",
    sha256: "2151f12a2c8569bdab5c8d4df86c91da200c40946318a75e7c1c883604dbb9fb",
  },
] as const

export type PublishedCharacterPack = (typeof PUBLISHED_CHARACTER_PACKS)[number]
