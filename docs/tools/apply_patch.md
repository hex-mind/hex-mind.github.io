# apply_patch

## 1. Input

- `patchText`: Full patch text in the `*** Begin Patch` ... `*** End Patch` format.

## 2. Output

- `title`: Short summary of the result.
- `output`: Execution result text, including file updates and LSP diagnostics if available.
- `metadata.diff`: Unified diff across all files.
- `metadata.files[].filePath`: Absolute path to the file.
- `metadata.files[].relativePath`: Workspace-relative path.
- `metadata.files[].type`: `add` / `update` / `move` / `delete`.
- `metadata.files[].diff`: Diff for the file.
- `metadata.files[].before`: File content before the change.
- `metadata.files[].after`: File content after the change.
- `metadata.files[].additions`: Number of added lines.
- `metadata.files[].deletions`: Number of deleted lines.
- `metadata.files[].movePath`: Target path for a move operation.
- `metadata.diagnostics`: LSP diagnostics.

## 3. JSON Example

```json
{
  "patchText": "*** Begin Patch\n*** Update File: src/app.ts\n@@\n-console.log('old')\n+console.log('new')\n*** End Patch"
}
```

## 4. Notes

- Patches are validated before applying. Invalid or empty hunks fail.
- Runs permission checks and then triggers FileWatcher/LSP updates.
