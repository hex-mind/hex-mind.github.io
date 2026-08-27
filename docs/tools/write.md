# write

## 1. Input

- `content`: Full content to write.
- `filePath`: Output file path.

## 2. Output

- `title`: Workspace-relative file path.
- `output`: Result text with optional LSP diagnostics.
- `metadata.filepath`: Absolute path to the file.
- `metadata.exists`: Whether the file existed.
- `metadata.diagnostics`: LSP diagnostics.

## 3. JSON Example

```json
{
  "filePath": "/path/to/project/src/config.ts",
  "content": "export const enabled = true\n"
}
```

## 4. Notes

- Uses edit permission checks.
- Triggers FileWatcher/LSP updates after writing.
