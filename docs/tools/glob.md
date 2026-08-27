# glob

## 1. Input

- `pattern`: Glob pattern to match.
- `path`: Base directory (optional).

## 2. Output

- `title`: Searched directory (workspace-relative).
- `output`: Newline-separated list of matched absolute paths.
- `metadata.count`: Number of matches returned.
- `metadata.truncated`: Whether output was truncated.

## 3. JSON Example

```json
{
  "pattern": "src/**/*.ts",
  "path": "/path/to/project"
}
```

## 4. Notes

- Returns up to 100 matches and marks truncation when exceeded.
