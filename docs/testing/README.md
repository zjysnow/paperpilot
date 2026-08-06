# Testing and development

Install dependencies and run the existing checks:

```bash
npm install
npm run typecheck
npm run test:unit
npm run test:workflow
npm test
```

Unit tests run with Mocha through `tsx`. `test/register.cjs` provides the
minimal Zotero global required by pure utility tests. Workflow smoke tests
verify that the preference surface and provider source remain Ollama-only.
