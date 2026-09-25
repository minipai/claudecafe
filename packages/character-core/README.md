# character-core

Host-neutral contracts shared by the Claude function profile and the OpenCode
plugin. This package deliberately has no filesystem, UI, network, Node, or
Claude/OpenCode imports; each host supplies those through an adapter.

The source is dependency-free TypeScript so the Claude function-hook runtime
and OpenCode can load the same implementation. The release shipper bundles or
copies this package into each plugin archive.
