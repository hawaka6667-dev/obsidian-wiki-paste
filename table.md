

对比原始粘贴文本与 Wiki Paste 扩展处理后的内容，x是原文，fx 表示一种能避开 Obsidian 解析冲突的写法，不是唯一标准答案

方便快速添加edge case和实现
---



| x                                | Code             | fx                                   | Code               | 表格不渲染 |
| -------------------------------- | ---------------- | ------------------------------------ | ------------------ | ----- |
| [^abc]                           | `[^abc]`         | \[^abc]                              | `\[^abc]`          |       |
| ### Heading ###                  | `# Heading`      | \### Heading ###                     | `\# Heading`       | 是     |
| - item                           | `- item`         | \- item -                            | `\- item`          |       |
| 1. item                          | `1. item`        | 1\. item1.                           | `1\. item`         |       |
| [[Page]]                         | `[[Page]]`       | \[\[Page]]                           | `\[\[Page]]`       |       |
| **bold**                         | `**bold**`       | \*\*bold**                           | `\*\*bold**`       | 是     |
| ~~strike~~                       | `~~strike~~`     | \~~strike\~~                         | `\~~strike\~~`     |       |
| ==mark==                         | `==mark==`       | \==mark\==                           | `\==mark\==`       |       |
| > [!note]                        | `> [!note]`      | \> \[!note]>                         | `\> \[!note]>`     |       |
| $x^2$                            | `$x^2$`          | \$x^2$                               | `\$x^2$`           |       |
| <span>x</span>                   | `<span>x</span>` | \<span>x\</span>                     | `\<span>x\</span>` |       |
| \.                               | `\.`             | \\.                                  | `\\.`              |       |
| ^3                               | `^3`             | \^3                                  | `\^3`              | 缺     |
| text #tag/sub-tag                |                  | text \#tag/sub-tag                   |                    |       |
| 12) ordered 12)                  |                  | 12\) ordered 12)                     |                    | 是     |
| `inline code`                    |                  | \`inline code\`                      |                    |       |
| *italic* 3                       |                  | \*italic\*3                          |                    |       |
| * italic* 3                      |                  | \* italic\* 3                        |                    | 是     |
| text***text***text text          |                  | text\*\*\*text\*\*\*text text        |                    |       |
| ---<br>                          |                  | \---                                 |                    | 是     |
| [label][ref]                     |                  | \[label]\[ref]                       |                    |       |
| [ label ][ref ]                  |                  | \[ label ]\[ref ]                    |                    |       |
| _italic_     _3       3  _     3 |                  | \_italic\_     \_3       3  \_     3 |                    |       |
| __bold__b 3b                     |                  | \_\_bold__b 3b                       |                    |       |
| %%comment%% 3                    |                  | \%%comment\%% 3                      |                    | 缺     |
| \\#tag                           |                  | \\\\\#tag                            |                    |       |


| x                                                                                                    | fx                                                                                                     |     |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --- |
| [abc…](https://regexone.com/lesson/introduction_abcs "Lesson 1: An Introduction, and the ABCs")      |                                                                                                        |     |
| [123…](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")                         |                                                                                                        |     |
| [\d](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")                           |                                                                                                        |     |
| [\D](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")                           |                                                                                                        |     |
| [.](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")                                   |                                                                                                        |     |
| [\.](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")                                  | [\\.](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")                                   |     |
| [[abc]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")    | [\[abc\]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")    |     |
| [[^abc]](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters") | [\[^abc\]](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters") |     |
| [[a-z]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   | [\[a-z\]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   |     |
| [[0-9]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   | [\[0-9\]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   |     |
| [\w](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                      |                                                                                                        |     |
| [\W](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                      |                                                                                                        |     |
| [{m}](https://regexone.com/lesson/repeating_characters "Lesson 6: Catching some zzz's")              |                                                                                                        |     |
| [{m,n}](https://regexone.com/lesson/repeating_characters "Lesson 6: Catching some zzz's")            |                                                                                                        |     |
| [*](https://regexone.com/lesson/kleene_operators "Lesson 7: Mr. Kleene, Mr. Kleene")                 |                                                                                                        |     |
| [+](https://regexone.com/lesson/kleene_operators "Lesson 7: Mr. Kleene, Mr. Kleene")                 |                                                                                                        |     |
| [?](https://regexone.com/lesson/optional_characters "Lesson 8: Characters optional")                 |                                                                                                        |     |
| [\s](https://regexone.com/lesson/whitespaces "Lesson 9: All this whitespace")                        |                                                                                                        |     |
| [\S](https://regexone.com/lesson/whitespaces "Lesson 9: All this whitespace")                        |                                                                                                        |     |
| [^…$](https://regexone.com/lesson/line_beginning_end "Lesson 10: Starting and ending")               |                                                                                                        |     |
| [(…)](https://regexone.com/lesson/capturing_groups "Lesson 11: Match groups")                        |                                                                                                        |     |
| [(a(bc))](https://regexone.com/lesson/nested_groups "Lesson 12: Nested groups")                      |                                                                                                        |     |
| [(.*)](https://regexone.com/lesson/more_groups "Lesson 13: More group work")                         |                                                                                                        |     |
| [(abc\|def)](https://regexone.com/lesson/conditionals "Lesson 14: It's all conditional")             |                                                                                                        |     |



fx空的就不管

先按每解析符号整理出基础逻辑，在根据不同情况优化掉不需要的“\”



@machine下面别碰

| \[^abc\]   |
| ---------- |
| \`[^abc]\` |
| [[abc]]    |
| [abc](url) |
| *          |
| _          |
| ~          |
| ==         |
| \|         |
| #          |

[\\.](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")

[\[abc\]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")

[\[^abc\]](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters")

[\[a-z\]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")



| [\\.](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")                                   |
| ------------------------------------------------------------------------------------------------------ |
| [\[abc\]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")    |
| [\[^abc\]](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters") |
| [\[a-z\]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   |
| [\[0-9\]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   |

[\[abc\]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")




|     |                                                                                                      |                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
|     | [abc…](https://regexone.com/lesson/introduction_abcs "Lesson 1: An Introduction, and the ABCs")      | [Letters](https://regexone.com/lesson/introduction_abcs "Lesson 1: An Introduction, and the ABCs")            |
|     | [123…](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")                         | [Digits](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")                                |
|     | [\d](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")                           | [Any Digit](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")                             |
|     | [\D](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")                           | [Any Non-digit character](https://regexone.com/lesson/letters_and_digits "Lesson 1½: The 123s")               |
|     | [.](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")                                   | [Any Character](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")                                |
|     | [\.](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")                                  | [Period](https://regexone.com/lesson/wildcards_dot "Lesson 2: The Dot")                                       |
|     | [[abc]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")    | [Only a, b, or c](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")   |
|     | [[^abc]](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters") | [Not a, b, nor c](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters") |
|     | [[a-z]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   | [Characters a to z](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                |
|     | [[0-9]](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   | [Numbers 0 to 9](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                   |
|     | [\w](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                      | [Any Alphanumeric character](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")       |
|     | [\W](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")                      | [Any Non-alphanumeric character](https://regexone.com/lesson/character_ranges "Lesson 5: Character ranges")   |
|     | [{m}](https://regexone.com/lesson/repeating_characters "Lesson 6: Catching some zzz's")              | [m Repetitions](https://regexone.com/lesson/repeating_characters "Lesson 6: Catching some zzz's")             |
|     | [{m,n}](https://regexone.com/lesson/repeating_characters "Lesson 6: Catching some zzz's")            | [m to n Repetitions](https://regexone.com/lesson/repeating_characters "Lesson 6: Catching some zzz's")        |
|     | [*](https://regexone.com/lesson/kleene_operators "Lesson 7: Mr. Kleene, Mr. Kleene")                 | [Zero or more repetitions](https://regexone.com/lesson/kleene_operators "Lesson 7: Mr. Kleene, Mr. Kleene")   |
|     | [+](https://regexone.com/lesson/kleene_operators "Lesson 7: Mr. Kleene, Mr. Kleene")                 | [One or more repetitions](https://regexone.com/lesson/kleene_operators "Lesson 7: Mr. Kleene, Mr. Kleene")    |
|     | [?](https://regexone.com/lesson/optional_characters "Lesson 8: Characters optional")                 | [Optional character](https://regexone.com/lesson/optional_characters "Lesson 8: Characters optional")         |
|     | [\s](https://regexone.com/lesson/whitespaces "Lesson 9: All this whitespace")                        | [Any Whitespace](https://regexone.com/lesson/whitespaces "Lesson 9: All this whitespace")                     |
|     | [\S](https://regexone.com/lesson/whitespaces "Lesson 9: All this whitespace")                        | [Any Non-whitespace character](https://regexone.com/lesson/whitespaces "Lesson 9: All this whitespace")       |
|     | [^…$](https://regexone.com/lesson/line_beginning_end "Lesson 10: Starting and ending")               | [Starts and ends](https://regexone.com/lesson/line_beginning_end "Lesson 10: Starting and ending")            |
|     | [(…)](https://regexone.com/lesson/capturing_groups "Lesson 11: Match groups")                        | [Capture Group](https://regexone.com/lesson/capturing_groups "Lesson 11: Match groups")                       |
|     | [(a(bc))](https://regexone.com/lesson/nested_groups "Lesson 12: Nested groups")                      | [Capture Sub-group](https://regexone.com/lesson/nested_groups "Lesson 12: Nested groups")                     |
|     | [(.*)](https://regexone.com/lesson/more_groups "Lesson 13: More group work")                         | [Capture all](https://regexone.com/lesson/more_groups "Lesson 13: More group work")                           |
|     | [(abc\|def)](https://regexone.com/lesson/conditionals "Lesson 14: It's all conditional")             | [Matches abc or def](https://regexone.com/lesson/conditionals "Lesson 14: It's all conditional")              |