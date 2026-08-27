# edit

## 1. Input

- `filePath`: Target file path (absolute preferred).
- `oldString`: Text to replace.
- `newString`: Replacement text (must differ).
- `replaceAll`: Replace all matches (optional).

## 2. Output

- `title`: Workspace-relative file path.
- `output`: Result text with optional LSP diagnostics.
- `metadata.diff`: Unified diff.
- `metadata.filediff.file`: File path.
- `metadata.filediff.before`: Content before change.
- `metadata.filediff.after`: Content after change.
- `metadata.filediff.additions`: Added line count.
- `metadata.filediff.deletions`: Deleted line count.
- `metadata.diagnostics`: LSP diagnostics.

## 3. JSON Example

```json
{
  "filePath": "/path/to/project/src/app.ts",
  "oldString": "console.log('old')",
  "newString": "console.log('new')",
  "replaceAll": false
}
```

## 4. Notes

- Attempts multiple replacers to tolerate whitespace/escape differences.
- Fails if multiple matches are found and asks for more context.
