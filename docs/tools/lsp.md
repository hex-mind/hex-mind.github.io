# lsp

## 1. Input

- `operation`: LSP operation name.
- `filePath`: Target file path.
- `line`: 1-based line number.
- `character`: 1-based character index.

## 2. Output

- `title`: `{operation} {relativePath}:{line}:{character}`.
- `output`: Result JSON string or a no-results message.
- `metadata.result`: Raw LSP result array.

## 3. JSON Example

```json
{
  "operation": "goToDefinition",
  "filePath": "src/main.ts",
  "line": 12,
  "character": 8
}
```

## 4. Notes

- Supported operations: `goToDefinition`, `findReferences`, `hover`, `documentSymbol`, `workspaceSymbol`, `goToImplementation`, `prepareCallHierarchy`, `incomingCalls`, `outgoingCalls`.
- Returns an error if no LSP client is available for the language.
