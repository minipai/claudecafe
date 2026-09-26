# character-core

Host-neutral contracts shared by the Claude function profile, desktop app and
OpenCode plugin. This package deliberately has no filesystem, UI, network, Node, or
Claude/OpenCode imports; each host supplies those through an adapter.

The source is dependency-free TypeScript so the Claude function-hook runtime
and OpenCode can load the same implementation. The release shipper bundles it
into the Claude runtime module, and `scripts/build-opencode-core.sh` refreshes
the package-local copy carried by the OpenCode archive.

`readContext(host, options)` supplies the shared greeting, mood-marker, time,
session age, commit count and festival context used by persona-panel and the
desktop. The host provides config and prompt reads, clock, weather and Git I/O;
character selection and rendering stay with each host.
