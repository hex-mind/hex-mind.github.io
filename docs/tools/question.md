# question

## 1. Input

- `questions[]`: Array of questions.
- `questions[].question`: Full question text.
- `questions[].header`: Short label.
- `questions[].options[]`: Answer choices.
- `questions[].options[].label`: Choice label.
- `questions[].options[].description`: Choice description.
- `questions[].multiple`: Allow multiple answers (optional).

## 2. Output

- `title`: `Asked N question(s)`.
- `output`: User reply summary.
- `metadata.answers[][]`: Selected labels for each question.

## 3. JSON Example

```json
{
  "questions": [
    {
      "question": "Which approach should we use?",
      "header": "Approach",
      "options": [
        { "label": "Option A", "description": "Simple implementation" },
        { "label": "Option B", "description": "More extensible" }
      ]
    }
  ]
}
```

## 4. Notes

- The internal `custom` option is handled by the tool and not part of the input schema.
