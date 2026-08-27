# batch

## 1. Input

- `tool_calls[]`: Array of tool calls to run in parallel (max 25).
- `tool_calls[].tool`: Tool name.
- `tool_calls[].parameters`: Parameters for that tool.

## 2. Output

- `title`: Summary including success count.
- `output`: Success/failure message.
- `attachments[]`: Aggregated attachments from sub-tools.
- `metadata.totalCalls`: Total number of calls.
- `metadata.successful`: Number of successful calls.
- `metadata.failed`: Number of failed calls.
- `metadata.tools[]`: Tool names included in the batch.
- `metadata.details[].tool`: Tool name.
- `metadata.details[].success`: Success boolean.

## 3. JSON Example

```json
{
  "tool_calls": [
    { "tool": "glob", "parameters": { "pattern": "src/**/*.ts" } },
    { "tool": "grep", "parameters": { "pattern": "TODO", "path": "/path/to/project" } }
  ]
}
```

## 4. Notes

- Nested batch calls are not supported.
- Each sub-tool emits its own status updates.
