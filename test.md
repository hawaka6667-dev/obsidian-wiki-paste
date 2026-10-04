@machine   此条目deprecated 我自己维护




点card粘贴的hack

allow single canvas card copy to md的hack

https://tool.box3.cn/editor/code.html 网页文本框

Markdown escape 的==不完整行为      大量样本不全   抓几个wiki的bug
和 &nbsp; 来源暂时排除在本任务之外

快速issue入口🚩

正方形hack

https://github.com/joeytoday/obsidian-canvas-enhance 抄作业
## Full expand 后续调研方向（待继续）           做成命令api

- 目标：真实粘贴到 Canvas 后，卡片高度完整容纳 Markdown 内容，不出现内部滚动条；以 Obsidian 中的实际粘贴结果验收，不以合成 clipboard 事件代替。
- 优先验证“按最终卡片宽度离屏测量”：克隆 Markdown 内容到屏外测量区，设为目标宽度并清除会限制自然高度的样式，等 Markdown 渲染可测后读取内容尺寸，同时计入卡片内边距和边框。
- 渲染尚未就绪或测量结果异常时做有限次数重试，避免无限轮询；随后调整真实卡片尺寸，并重新读取 live DOM 的 `scrollHeight` / `clientHeight`，只按仍存在的溢出差值补高，可加小幅安全余量。
- 重点核对宽度变化、长 Markdown、图片/异步内容、编辑态与预览态，以及 Canvas 布局/渲染时序；每次在 Obsidian 里记录卡片尺寸和预览区 `scrollHeight`、`clientHeight`，确认无滚动条。
- 暂不沿用“live DOM 高度连续稳定后再扩展”的轮询方案：已有试验未消除溢出。社区实现可作为机制参考（Canvas Enhance 的更新事件与合帧调整；Node Autosize 的最终宽度离屏测量及扩展后溢出修正），但不要直接依赖未验证的私有 Canvas API。
- A/B 约束不变：候选仅分发到 GameDevVault，wiki paste 保持基线；两侧相关设置维持开启。Markdown escape 的 `==` 行为和 `&nbsp;` 来源仍排除在本任务之外。








