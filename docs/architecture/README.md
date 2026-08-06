# Architecture

The plugin entry point is in `src/index.ts`. The chat surface lives under
`src/modules/contextPanel/`; its UI construction, state, request lifecycle,
context resolution, and menu controllers are separated into focused modules.

Provider configuration is normalized in `src/utils/modelProviders.ts`.
`src/utils/providerPresets.ts` identifies the local Ollama endpoint and
`src/utils/providerProtocol.ts` describes its streaming chat capability.
`src/modules/contextPanel/chat.ts` builds Ollama requests and consumes the
stream.

Unsupported agent-mode and alternate-provider branches are not part of the
active runtime. Controls for unavailable advanced capabilities should remain
explicitly disabled or report their status rather than silently doing nothing.
