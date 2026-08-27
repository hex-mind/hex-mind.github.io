# bash

## 1. Input

- `command`: Shell command to run.
- `timeout`: Timeout in milliseconds (optional).
- `workdir`: Working directory (optional).
- `description`: Short description (5-10 words).

## 2. Output

- `title`: The description provided in the input.
- `output`: Combined stdout/stderr text.
- `metadata.output`: Truncated output preview.
- `metadata.exit`: Process exit code.
- `metadata.description`: Input description.

## 3. JSON Example

```json
{
  "command": "pytest tests",
  "workdir": "/path/to/project",
  "timeout": 120000,
  "description": "Run Python test suite"
}
```

## 4. Notes

- Commands are parsed before execution and may require permission checks.
- On timeout or abort, metadata is appended to the output.
