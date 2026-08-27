# codesearch

## 1. Input

- `query`: Search query for code/API references.
- `tokensNum`: Context size (1000-50000, default 5000).

## 2. Output

- `title`: `Code search: {query}`.
- `output`: Retrieved context text or a not-found message.
- `metadata`: Currently an empty object.

## 3. JSON Example

```json
{
  "query": "React useState hook examples",
  "tokensNum": 5000
}
```

## 4. Notes

- Sends a POST request to an external MCP API and parses SSE `data:` lines.
- Times out with a `Code search request timed out` error.
