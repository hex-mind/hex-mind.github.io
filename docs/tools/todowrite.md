# todowrite

## 1. Input

- `todos[]`: Full todo list state.
- `todos[].id`: Todo ID.
- `todos[].content`: Task description.
- `todos[].status`: `pending` / `in_progress` / `completed` / `cancelled`.
- `todos[].priority`: `high` / `medium` / `low`.

## 2. Output

- `title`: Summary including the number of unfinished todos.
- `output`: JSON string of the saved todo list.
- `metadata.todos[]`: Persisted todos.

## 3. JSON Example

```json
{
  "todos": [
    { "id": "t1", "content": "Implement parser", "status": "in_progress", "priority": "high" },
    { "id": "t2", "content": "Write tests", "status": "pending", "priority": "medium" }
  ]
}
```

## 4. Notes

- The input replaces the entire todo list, not a diff.
