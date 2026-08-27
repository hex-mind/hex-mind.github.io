# grep

## 1. Input

- `pattern`: Regex pattern to search.
- `path`: Directory to search (optional).
- `include`: Glob filter for files (optional).

## 2. Output

- `title`: The search pattern.
- `output`: Results text with file paths and line numbers.
- `metadata.matches`: Number of matches returned.
- `metadata.truncated`: Whether output was truncated.

## 3. JSON Example

```json
{
  "pattern": "function\\s+\\w+",
  "path": "/path/to/project",
  "include": "*.ts"
}
```

## 4. Notes

- Uses ripgrep internally and formats the results.
- Exit code 2 still returns output if matches were produced.
