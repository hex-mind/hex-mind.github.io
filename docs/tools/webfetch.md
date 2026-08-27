# webfetch

## 1. Input

- `url`: URL to fetch (`http://` or `https://`).
- `format`: `text` / `markdown` / `html` (default `markdown`).
- `timeout`: Timeout in seconds (max 120, optional).

## 2. Output

- `title`: `{url} ({content-type})`.
- `output`: Retrieved content in the requested format.
- `metadata`: Currently an empty object.

## 3. JSON Example

```json
{
  "url": "https://example.com",
  "format": "markdown",
  "timeout": 30
}
```

## 4. Notes

- HTML is converted to markdown when requested.
- Response size is limited to 5MB.
- May retry with a different User-Agent when challenged by a CDN.
