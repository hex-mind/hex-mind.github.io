# ls

## 1. Input

- `path`: Directory to list (optional).
- `ignore[]`: Additional glob patterns to ignore.

## 2. Output

- `title`: Target directory (workspace-relative).
- `output`: Tree-style listing of directories and files.
- `metadata.count`: Number of collected items.
- `metadata.truncated`: Whether output was truncated.

## 3. JSON Example

```json
{
  "path": "/path/to/project",
  "ignore": ["dist/**", "coverage/**"]
}
```

## 4. Notes

- The internal tool id is `list`.
- Default ignore patterns include common build and VCS directories.
