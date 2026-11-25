# Markdown Paste Escaping
只记case和整理，只有case失败时才补充

- `~~strike~~` 转为 `\~~strike\~~`；`==mark==` 转为 `\==mark\==`，开头和闭合标记都要转义。
- 脚注定义 `[^ref29]: Footnote source.` 在开启转义时转为 `\[^ref29]: Footnote source.`；脚注引用与定义分开派发，并用相同 ID 配对检查原生解析和字面文本。

