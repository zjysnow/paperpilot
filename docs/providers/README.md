# Provider setup

## Ollama

1. Install and start Ollama.
2. Pull a chat model, for example `ollama pull llama3.2`.
3. In Zotero, open **Preferences > Paper Pilot > AI Providers**.
4. Click **Add local Ollama provider**.
5. Click **Refresh Ollama models** after pulling another model.
6. Select the discovered model in the chat panel.

The default local URL is `http://localhost:11434/v1`. Paper Pilot sends chat
requests to Ollama's native `http://localhost:11434/api/chat` endpoint and
consumes its newline-delimited streaming response.

Only Ollama is supported in this phase. Non-Ollama JSON provider groups are
discarded during normalization, so an old configuration cannot accidentally
become an active remote provider.
