# read

## 1. Input

- `filePath`: Absolute path of the file or directory to read.
- `offset`: Start line (1-indexed, optional). For directories, 1-indexed entry offset.
- `limit`: Number of lines/entries to read (default 2000).

## 2. Output

### Common fields

- `title`: Workspace-relative path.

### File read

- `output`: XML-structured text containing:
  - `<path>`: Absolute file path.
  - `<type>file</type>`
  - `<content>`: File content. Each line prefixed with `{lineNumber}: `. Truncation note appended when applicable.
  - Optional `<system-reminder>`: Instruction prompts loaded from associated instruction files.
- `metadata.preview`: First 20 lines (raw, without line-number prefix).
- `metadata.truncated`: Whether output was truncated (by line limit or byte limit of 50 KB).
- `metadata.loaded[]`: Paths of additional instruction files loaded (if any).
- `attachments[]`: File parts for images/PDFs (base64 `data:` URL with mime type).

### Directory read

- `output`: XML-structured text containing:
  - `<path>`: Absolute directory path.
  - `<type>directory</type>`
  - `<entries>`: Sorted entry names, one per line. Subdirectories (and symlinks pointing to directories) have a trailing `/`. Pagination note appended when truncated.
- `metadata.preview`: First 20 entries.
- `metadata.truncated`: Whether entry list was truncated.
- `metadata.loaded[]`: Always empty (`[]`).

## 3. JSON Examples

### File

```json
{
  "filePath": "/path/to/project/src/main.ts",
  "offset": 1,
  "limit": 200
}
```

### Directory

```json
{
  "filePath": "/path/to/project/src"
}
```

## 4. Output Examples

### File output

```
<path>/path/to/project/src/main.ts</path>
<type>file</type>
<content>
1: import { app } from "./app"
2: app.listen(3000)

(End of file - total 2 lines)
</content>
```

### Directory output

```
<path>/path/to/project/src</path>
<type>directory</type>
<entries>
components/
lib/
main.ts
utils.ts

(4 entries)
</entries>
```

## 5. Notes

- Image/PDF reads return attachments (base64 data URL) instead of text content.
- File output has per-line truncation (2000 chars) and total byte limit (50 KB).
- Directory entries are sorted lexicographically.
- `offset` and `limit` work for both files (line-based) and directories (entry-based).
- Symlinks to directories get the trailing `/` suffix.
