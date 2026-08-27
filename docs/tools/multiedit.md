# multiedit

## 1. Input

- `filePath`: Target file path.
- `edits[]`: Array of edits to apply in order.
- `edits[].filePath`: File path (usually same as `filePath`).
- `edits[].oldString`: Text to replace.
- `edits[].newString`: Replacement text.
- `edits[].replaceAll`: Replace all matches (optional).

## 2. Output

- `title`: Workspace-relative file path.
- `output`: Output from the final edit.
- `metadata.results[]`: Metadata from each edit execution.

## 3. JSON Example

```json
{
  "filePath": "/path/to/project/src/app.ts",
  "edits": [
    { "filePath": "/path/to/project/src/app.ts", "oldString": "foo", "newString": "bar" },
    {
      "filePath": "/path/to/project/src/app.ts",
      "oldString": "baz",
      "newString": "qux",
      "replaceAll": true
    }
  ]
}
```

## 4. Notes

- Internally calls `edit` sequentially.
- Later edits run against the result of earlier edits.
