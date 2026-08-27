# task

## 1. Input

- `description`: Short task description (3-5 words).
- `prompt`: Instructions for the sub-agent.
- `subagent_type`: Sub-agent type.
- `task_id`: Existing subtask session ID (optional).
- `command`: Command that triggered the task (optional).

## 2. Output

- `title`: The task description.
- `output`: Text containing `task_id` and a `<task_result>` block.
- `metadata.sessionId`: Sub-agent session ID.
- `metadata.model.providerID`: Provider ID used by the sub-agent.
- `metadata.model.modelID`: Model ID used by the sub-agent.
- `metadata.summary[]`: Tool execution summaries for the sub-session.
- `metadata.summary[].id`: Tool part ID.
- `metadata.summary[].tool`: Tool name.
- `metadata.summary[].state.status`: Execution status.
- `metadata.summary[].state.title`: Completion title (if any).

## 3. JSON Example

```json
{
  "description": "Explore API handlers",
  "prompt": "Search the codebase and summarize all API routes",
  "subagent_type": "explore"
}
```

## 4. Notes

- Passing `task_id` continues an existing sub-session.
- `todowrite` and `todoread` are not allowed in sub-agent sessions.
