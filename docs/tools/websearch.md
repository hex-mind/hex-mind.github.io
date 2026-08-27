# websearch

## 1. Input

- `query`: Search query.
- `numResults`: Number of results (default 8).
- `livecrawl`: `fallback` / `preferred` (default `fallback`).
- `type`: `auto` / `fast` / `deep` (default `auto`).
- `contextMaxCharacters`: Max context size (optional).

## 2. Output

- `title`: `Web search: {query}`.
- `output`: Result text or a not-found message.
- `metadata`: Currently an empty object.

## 3. JSON Example

```json
{
  "query": "TypeScript project references",
  "numResults": 5,
  "type": "auto",
  "livecrawl": "fallback"
}
```

## 4. Notes

- Sends a POST request to an external MCP API and parses SSE `data:` lines.
- Times out with a `Search request timed out` error.
