# todoread

## 1. Input

- No parameters (empty object).

## 2. Output

- `title`: Summary including the number of unfinished todos.
- `output`: JSON string of the todo array.
- `metadata.todos[]`: List of todos.
- `metadata.todos[].id`: Todo ID.
- `metadata.todos[].content`: Todo content.
- `metadata.todos[].status`: `pending` / `in_progress` / `completed` / `cancelled`.
- `metadata.todos[].priority`: `high` / `medium` / `low`.

## 3. JSON Example

```json
{}
```

## 4. Notes

- Primary use is reloading session todo state.
