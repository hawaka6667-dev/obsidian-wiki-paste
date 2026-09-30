源码与旧 bundle 分叉会造成旧行为继续运行、引发误判/bug

[[abc]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")




https://community.obsidian.md/plugins/masking-as-md       参考
https://github.com/mofukuru/TsumugiMark

双版本控制        build版本   builder版本



https://community.obsidian.md/account/plugins/wiki-paste   自动review



|   |   |
|---|---|
|[[^abc]](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters")|[Not a, b, nor c](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters")|




### Character order  角色順序

ASCII-code order is also called _ASCIIbetical_ order.[\[34\]](https://en.wikipedia.org/wiki/ASCII#cite_note-35) [Collation](https://en.wikipedia.org/wiki/Collation "Collation") of data is sometimes done in this order rather than "standard" alphabetical order ([collating sequence](https://en.wikipedia.org/wiki/Collating_sequence "Collating sequence")). The main deviations in ASCII order are:











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


|                                                                                                      |                                                                                                               |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [[^abc]](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters") | [Not a, b, nor c](https://regexone.com/lesson/excluding_characters "Lesson 4: Excluding specific characters") |





[\[abc\]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")


|   |   |
|---|---|
|[[abc]](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")|[Only a, b, or c](https://regexone.com/lesson/matching_characters "Lesson 3: Matching specific characters")|



