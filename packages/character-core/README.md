# character-core

Host-neutral contracts shared by the Claude function profile and the OpenCode
plugin. This package deliberately has no filesystem, UI, network, Node, or
Claude/OpenCode imports; each host supplies those through an adapter.

The source is dependency-free TypeScript so the Claude function-hook runtime
and OpenCode can load the same implementation. The release shipper bundles it
into the Claude runtime module, and `scripts/build-opencode-core.sh` refreshes
the package-local copy carried by the OpenCode archive.
