# Master 到 Uncertain 分支同步政策

本文规定 `master` 功能同步到 `uncertain` 时的可追溯性要求。目标是确保每项同步功能都能通过 Git 提交历史定位来源，禁止把未提交工作树内容当作分支功能更新。

## 必须满足的条件

1. 来源和目标工作树都必须干净。
2. 来源功能必须先存在于 `master` 的提交记录中。
3. `uncertain` 应通过合并保留 `master` 的提交祖先关系，避免再次使用无法追溯原始提交的手工复制或聚合提交。
4. 同步完成后，`origin/master` 必须是 `uncertain` 的祖先。
5. 测试结果、来源提交哈希、目标提交哈希和回滚锚点必须保留在同步记录中。

## 标准同步流程

```bash
git fetch origin master uncertain
git status --short --branch
git log origin/master --reverse --date=iso-strict \
  --pretty=format:'%H%x09%P%x09%ad%x09%an%x09%s'
git log --left-right --cherry-pick --no-merges \
  origin/uncertain...origin/master
git branch backup/uncertain-before-master-sync-YYYYMMDD HEAD
git merge --no-ff --no-commit origin/master
```

解决冲突时，应逐项核对较新的 `master` 实现和 `uncertain` 的独有行为。不得用“文件看起来相似”代替提交来源分析。

合并、测试并提交后运行：

```bash
node scripts/verify-branch-sync.mjs origin/master HEAD \
  --source-worktree ../inkos_master
```

CI 会在 `uncertain` 分支和以 `uncertain` 为目标的拉取请求上运行同一验证脚本。

## 无 Git Log 记录的异常更新

以下任一情况都视为异常：

- `master` 工作树存在修改或未跟踪文件，但相关功能未提交。
- 在 `uncertain` 中发现来源于 `master` 的功能，却无法定位来源提交。
- 同步后 `origin/master` 不是目标分支祖先。
- 测试所验证的功能只存在于工作树，不存在于 `HEAD`。

发现异常后必须立即停止同步，不得继续复制文件或提交模糊的 `sync changes` 更新。

处理流程：

1. 记录来源和目标的 `git status --short --branch`、`git diff`、`HEAD` 哈希。
2. 从异常工作树当前 `HEAD` 创建 `quarantine/YYYYMMDD-unlogged-master-update` 分支。
3. 将异常变化作为明确标注的隔离提交保存，供负责人确认来源、范围和预期行为。
4. 有效功能必须先以正常功能或修复提交进入 `master`，通过测试后再按标准流程同步。
5. 无效或误操作变化只能在负责人确认后丢弃。不得在共享分支上使用会改写历史的回滚方式。

## 回滚策略

- 同步前使用 `backup/uncertain-before-master-sync-YYYYMMDD` 保存本地回滚锚点。
- 已共享或已推送的合并提交使用 `git revert -m 1 <merge-commit>` 回滚，保留完整审计历史。
- 验证机制或后续修复提交使用普通 `git revert <commit>` 回滚。
- 仅本地、未共享的分支如需改写历史，必须先获得负责人明确确认。

回滚后必须重新运行测试和 `verify-branch-sync.mjs`，并在回滚提交中说明失败原因和受影响功能。

## 审计记录

每次同步至少记录：

- `master` 来源提交哈希和完整可达提交数量
- `uncertain` 同步前提交哈希
- 合并提交哈希
- 回滚锚点名称
- 冲突文件及解决原则
- 构建、测试和分支同步验证结果
