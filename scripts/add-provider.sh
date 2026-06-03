#!/usr/bin/env bash
# ============================================================================
# add-provider.sh — 添加新 LLM 服务商的标准化流程脚本
#
# 用法:
#   ./scripts/add-provider.sh [选项]
#
# 选项:
#   --id=<id>              服务商唯一标识 (必填, 小写, 下划线分隔, 如 sensenova_2)
#   --label=<label>        UI 显示名 (必填, 如 "商汤日日新 2")
#   --group=<group>        分组 (必填, overseas|china|aggregator|local|codingPlan)
#   --api=<api>            API 协议 (必填, openai-completions|openai-responses|anthropic-messages|google-generative-ai)
#   --base-url=<url>       API 基础 URL (必填, 如 https://api.example.com/v1)
#   --check-model=<model>  API key 验证用的模型 id (可选)
#   --batch=<batch>        批次 (必填, B1|B2|B3|B4|B6)
#   --const-name=<name>    导出常量名 (可选, 默认从 id 自动生成)
#   --file-name=<name>     文件名 (不含 .ts, 可选, 默认从 id 自动生成)
#
# 模型来源 (三选一, 不指定则生成 TODO 占位符):
#   --copy-models-from=<id>  从已有服务商复制模型列表 (如 --copy-models-from=sensenova)
#   --probe-models=<key>     用 API key 从 --base-url 的 /models 端点探测模型列表
#   --models-file=<path>     从 JSON 文件读取模型列表 (格式见下方)
#
#   --dry-run              仅输出将要执行的操作, 不实际修改文件
#
# 模型 JSON 文件格式 (--models-file):
#   [
#     { "id": "model-name", "maxOutput": 4096, "contextWindowTokens": 32768, "enabled": true, "releasedAt": "2025-01-01" }
#   ]
#
# 示例:
#   # 1) 从已有服务商复制模型 (适用于同 API 不同入口的场景, 如 sensenova_2)
#   ./scripts/add-provider.sh \
#     --id=sensenova_2 --label="商汤日日新 2" --group=china \
#     --api=openai-completions --base-url="https://token.sensenova.cn/v1" \
#     --check-model=sensenova-6.7-flash-lite --batch=B2 \
#     --copy-models-from=sensenova
#
#   # 2) 从上游 API 探测模型 (适用于全新服务商, 需要有效的 API key)
#   ./scripts/add-provider.sh \
#     --id=newprovider --label="新服务商" --group=china \
#     --api=openai-completions --base-url="https://api.newprovider.com/v1" \
#     --batch=B2 --probe-models=sk-xxxx
#
#   # 3) 从 JSON 文件导入模型 (适用于手动准备模型列表)
#   ./scripts/add-provider.sh \
#     --id=newprovider --label="新服务商" --group=china \
#     --api=openai-completions --base-url="https://api.newprovider.com/v1" \
#     --batch=B2 --models-file=./my-models.json
#
#   # 4) 不指定模型来源, 生成 TODO 占位符 (后续手动填写)
#   ./scripts/add-provider.sh \
#     --id=newprovider --label="新服务商" --group=china \
#     --api=openai-completions --base-url="https://api.newprovider.com/v1" \
#     --batch=B2
#
# ============================================================================
set -euo pipefail

# ── 颜色输出 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 解析参数 ──
ID=""
LABEL=""
GROUP=""
API=""
BASE_URL=""
CHECK_MODEL=""
BATCH=""
CONST_NAME=""
FILE_NAME=""
COPY_MODELS_FROM=""
PROBE_MODELS=""
MODELS_FILE=""
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --id=*)              ID="${arg#--id=}" ;;
    --label=*)           LABEL="${arg#--label=}" ;;
    --group=*)           GROUP="${arg#--group=}" ;;
    --api=*)             API="${arg#--api=}" ;;
    --base-url=*)        BASE_URL="${arg#--base-url=}" ;;
    --check-model=*)     CHECK_MODEL="${arg#--check-model=}" ;;
    --batch=*)           BATCH="${arg#--batch=}" ;;
    --const-name=*)      CONST_NAME="${arg#--const-name=}" ;;
    --file-name=*)       FILE_NAME="${arg#--file-name=}" ;;
    --copy-models-from=*) COPY_MODELS_FROM="${arg#--copy-models-from=}" ;;
    --probe-models=*)    PROBE_MODELS="${arg#--probe-models=}" ;;
    --models-file=*)     MODELS_FILE="${arg#--models-file=}" ;;
    --dry-run)           DRY_RUN=true ;;
    --help|-h)           head -n 70 "$0" | grep '^#' | sed 's/^# \?//'; exit 0 ;;
    *)                   err "未知参数: $arg" ;;
  esac
done

# ── 参数校验 ──
[[ -z "$ID" ]]         && err "缺少必填参数 --id"
[[ -z "$LABEL" ]]      && err "缺少必填参数 --label"
[[ -z "$GROUP" ]]      && err "缺少必填参数 --group"
[[ -z "$API" ]]        && err "缺少必填参数 --api"
[[ -z "$BASE_URL" ]]   && err "缺少必填参数 --base-url"
[[ -z "$BATCH" ]]      && err "缺少必填参数 --batch"

VALID_GROUPS="overseas china aggregator local codingPlan"
echo "$VALID_GROUPS" | grep -qw "$GROUP" || err "无效 group: $GROUP (有效值: $VALID_GROUPS)"

VALID_APIS="openai-completions openai-responses anthropic-messages google-generative-ai"
echo "$VALID_APIS" | grep -qw "$API" || err "无效 api: $API (有效值: $VALID_APIS)"

VALID_BATCHES="B1 B2 B3 B4 B6"
echo "$VALID_BATCHES" | grep -qw "$BATCH" || err "无效 batch: $BATCH (有效值: $VALID_BATCHES)"

# CodingPlan 分组强制 anthropic-messages
if [[ "$GROUP" == "codingPlan" && "$API" != "anthropic-messages" ]]; then
  err "codingPlan 分组的服务商必须使用 api=anthropic-messages"
fi

# 模型来源互斥校验
MODELS_SOURCE_COUNT=0
[[ -n "$COPY_MODELS_FROM" ]] && MODELS_SOURCE_COUNT=$((MODELS_SOURCE_COUNT + 1))
[[ -n "$PROBE_MODELS" ]]     && MODELS_SOURCE_COUNT=$((MODELS_SOURCE_COUNT + 1))
[[ -n "$MODELS_FILE" ]]      && MODELS_SOURCE_COUNT=$((MODELS_SOURCE_COUNT + 1))
if [[ $MODELS_SOURCE_COUNT -gt 1 ]]; then
  err "--copy-models-from、--probe-models、--models-file 三者只能选一个"
fi

# ── 自动生成常量名和文件名 ──
if [[ -z "$CONST_NAME" ]]; then
  CONST_NAME=$(echo "$ID" | sed 's/\([a-z0-9]\)\([A-Z]\)/\1_\2/g' | tr '[:lower:]' '[:upper:]')
fi

if [[ -z "$FILE_NAME" ]]; then
  FILE_NAME=$(echo "$ID" | sed -E 's/_([a-z])/\U\1/g; s/_([0-9])/\1/g')
fi

# ── 项目路径 ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENDPOINTS_DIR="$PROJECT_ROOT/packages/core/src/llm/providers/endpoints"
INDEX_FILE="$PROJECT_ROOT/packages/core/src/llm/providers/index.ts"
GROUP_TEST="$PROJECT_ROOT/packages/core/src/__tests__/providers-group.test.ts"
SCHEMA_TEST="$PROJECT_ROOT/packages/core/src/__tests__/providers-schema.test.ts"
STUDIO_TEST="$PROJECT_ROOT/packages/studio/src/api/server.test.ts"
LOOKUP_FILE="$PROJECT_ROOT/packages/core/src/llm/providers/lookup.ts"

ENDPOINT_FILE="$ENDPOINTS_DIR/${FILE_NAME}.ts"

# ── 检查是否已存在 ──
if [[ -f "$ENDPOINT_FILE" ]]; then
  err "端点文件已存在: $ENDPOINT_FILE"
fi

if grep -q "\"$ID\"" "$INDEX_FILE" 2>/dev/null; then
  err "服务商 id '$ID' 已在 index.ts 中注册"
fi

# ── Dry-run 模式 ──
if $DRY_RUN; then
  echo ""
  info "=== DRY RUN 模式: 以下为将要执行的操作 ==="
  echo ""
fi

# ============================================================================
# Step 1: 生成模型列表
# ============================================================================
info "Step 1/8: 生成模型列表"

MODELS_TS=""  # 最终写入 models: [...] 的 TypeScript 内容

# ── 方式 A: 从已有服务商复制 ──
if [[ -n "$COPY_MODELS_FROM" ]]; then
  SOURCE_FILE="$ENDPOINTS_DIR/$(echo "$COPY_MODELS_FROM" | sed -E 's/_([a-z])/\U\1/g; s/_([0-9])/\1/g').ts"
  if [[ ! -f "$SOURCE_FILE" ]]; then
    err "源服务商端点文件不存在: $SOURCE_FILE (id: $COPY_MODELS_FROM)"
  fi

  info "  从 $COPY_MODELS_FROM 复制模型列表"

  # 用 python 从源文件提取 models 数组的 TypeScript 源码
  MODELS_TS=$(python3 -c "
import re, sys

with open('$SOURCE_FILE', 'r') as f:
    content = f.read()

# 匹配 models: [ ... ] 块 (含嵌套大括号)
match = re.search(r'models:\s*\[(.*?)\]', content, re.DOTALL)
if not match:
    print('ERROR: 未找到 models 数组', file=sys.stderr)
    sys.exit(1)

# 提取并缩进
models_body = match.group(1).strip()
# 统一缩进: 每行前加 4 空格
lines = []
for line in models_body.split('\n'):
    stripped = line.strip()
    if stripped:
        lines.append('    ' + stripped)
print('\n'.join(lines))
" 2>&1) || err "从 $COPY_MODELS_FROM 提取模型列表失败:\n$MODELS_TS"

  if [[ -z "$CHECK_MODEL" ]]; then
    # 尝试从源服务商继承 checkModel
    SOURCE_CHECK_MODEL=$(python3 -c "
import re
with open('$SOURCE_FILE', 'r') as f:
    content = f.read()
match = re.search(r'checkModel:\s*\"([^\"]+)\"', content)
print(match.group(1) if match else '')
" 2>/dev/null)
    if [[ -n "$SOURCE_CHECK_MODEL" ]]; then
      CHECK_MODEL="$SOURCE_CHECK_MODEL"
      info "  继承 checkModel: $CHECK_MODEL"
    fi
  fi

# ── 方式 B: 从上游 /models API 探测 ──
elif [[ -n "$PROBE_MODELS" ]]; then
  info "  从 $BASE_URL/models 探测模型列表 (API key: ${PROBE_MODELS:0:8}...)"

  PROBE_URL="${BASE_URL%/}/models"
  PROBE_RESULT=$(curl -sS -f -H "Authorization: Bearer $PROBE_MODELS" "$PROBE_URL" 2>&1) || \
    err "探测 /models 失败: $PROBE_URL\n$PROBE_RESULT"

  # 将探测结果转为 TypeScript 模型卡片
  MODELS_TS=$(python3 -c "
import json, sys

data = json.loads('''$PROBE_RESULT''')
model_list = data.get('data', [])
if not model_list:
    print('ERROR: /models 返回空列表', file=sys.stderr)
    sys.exit(1)

lines = []
for m in model_list:
    mid = m.get('id', '')
    if not mid:
        continue
    # 默认参数: 探测无法获取精确值, 使用保守默认
    lines.append('    { id: \"' + mid + '\", maxOutput: 4096, contextWindowTokens: 32768 }')

if not lines:
    print('ERROR: 无有效模型 id', file=sys.stderr)
    sys.exit(1)

print(',\n'.join(lines))
" 2>&1) || err "解析探测结果失败:\n$MODELS_TS"

  info "  探测到 $(echo "$MODELS_TS" | grep -c '{ id:') 个模型"

  # 自动设置 checkModel 为第一个模型
  if [[ -z "$CHECK_MODEL" ]]; then
    CHECK_MODEL=$(echo "$MODELS_TS" | grep -oP 'id: "\K[^"]+' | head -1)
    info "  自动设置 checkModel: $CHECK_MODEL"
  fi

# ── 方式 C: 从 JSON 文件读取 ──
elif [[ -n "$MODELS_FILE" ]]; then
  if [[ ! -f "$MODELS_FILE" ]]; then
    err "模型文件不存在: $MODELS_FILE"
  fi

  info "  从 $MODELS_FILE 读取模型列表"

  MODELS_TS=$(python3 -c "
import json, sys

with open('$MODELS_FILE', 'r') as f:
    models = json.load(f)

if not isinstance(models, list):
    print('ERROR: JSON 文件顶层必须是数组', file=sys.stderr)
    sys.exit(1)

lines = []
for m in models:
    mid = m.get('id', '')
    if not mid:
        continue
    parts = ['id: \"' + mid + '\"']

    if 'maxOutput' in m:
        parts.append('maxOutput: ' + str(m['maxOutput']))
    if 'contextWindowTokens' in m:
        parts.append('contextWindowTokens: ' + str(m['contextWindowTokens']))
    if m.get('enabled') is not None:
        parts.append('enabled: ' + str(m['enabled']).lower())
    if 'releasedAt' in m:
        parts.append('releasedAt: \"' + m['releasedAt'] + '\"')

    # capabilities
    caps = m.get('capabilities')
    if caps:
        cap_parts = []
        for k in ['text', 'imageInput', 'imageOutput', 'tools', 'reasoning']:
            if k in caps:
                cap_parts.append(k + ': ' + str(caps[k]).lower())
        if cap_parts:
            parts.append('capabilities: { ' + ', '.join(cap_parts) + ' }')

    # status
    if 'status' in m:
        parts.append('status: \"' + m['status'] + '\"')

    lines.append('    { ' + ', '.join(parts) + ' }')

if not lines:
    print('ERROR: 无有效模型', file=sys.stderr)
    sys.exit(1)

print(',\n'.join(lines))
" 2>&1) || err "解析模型文件失败:\n$MODELS_TS"

  info "  读取到 $(echo "$MODELS_TS" | grep -c '{ id:') 个模型"

  # 自动设置 checkModel 为第一个 enabled 模型
  if [[ -z "$CHECK_MODEL" ]]; then
    CHECK_MODEL=$(echo "$MODELS_TS" | grep 'enabled: true' | grep -oP 'id: "\K[^"]+' | head -1)
    [[ -z "$CHECK_MODEL" ]] && CHECK_MODEL=$(echo "$MODELS_TS" | grep -oP 'id: "\K[^"]+' | head -1)
    info "  自动设置 checkModel: $CHECK_MODEL"
  fi

# ── 方式 D: 无模型来源, 生成 TODO 占位符 ──
else
  MODELS_TS="    // TODO: 添加模型卡片
    // { id: \"model-id\", maxOutput: 4096, contextWindowTokens: 32768, enabled: true, releasedAt: \"2025-01-01\" },"
  warn "  未指定模型来源, 将生成 TODO 占位符, 后续需手动填写"
fi

# ============================================================================
# Step 2: 创建端点定义文件
# ============================================================================
info "Step 2/8: 创建端点定义文件"

# 确定 compat 模板
if [[ "$API" == anthropic-* ]]; then
  COMPAT_BLOCK=""
else
  COMPAT_BLOCK="  compat: {
    supportsStore: false,
    supportsDeveloperRole: false,
    maxTokensField: \"max_tokens\",
    supportsUsageInStreaming: true,
  },"
fi

# 确定 temperatureRange 默认值
if [[ "$API" == "anthropic-messages" ]]; then
  TEMP_RANGE="[0, 1]"
  DEFAULT_TEMP="1.0"
  WRITING_TEMP="1.0"
else
  TEMP_RANGE="[0, 2]"
  DEFAULT_TEMP="1"
  WRITING_TEMP="1"
fi

# 构建 checkModel 行
CHECK_MODEL_LINE=""
if [[ -n "$CHECK_MODEL" ]]; then
  CHECK_MODEL_LINE="  checkModel: \"$CHECK_MODEL\","
fi

# 构建端点文件内容
ENDPOINT_CONTENT="/**
 * ${LABEL}
 *
 * - 官网：
 * - 控制台 / API key：
 * - API 文档：
 */
import type { InkosEndpoint } from \"../types.js\";

export const ${CONST_NAME}: InkosEndpoint = {
  id: \"${ID}\",
  label: \"${LABEL}\",
  group: \"${GROUP}\",
  api: \"${API}\",
  baseUrl: \"${BASE_URL}\",
${CHECK_MODEL_LINE}
  temperatureRange: ${TEMP_RANGE},
  defaultTemperature: ${DEFAULT_TEMP},
  writingTemperature: ${WRITING_TEMP},
${COMPAT_BLOCK}
  models: [
${MODELS_TS}
  ],
};
"

if $DRY_RUN; then
  echo "--- 将创建文件: $ENDPOINT_FILE ---"
  echo "$ENDPOINT_CONTENT"
  echo "---"
else
  mkdir -p "$ENDPOINTS_DIR"
  echo "$ENDPOINT_CONTENT" > "$ENDPOINT_FILE"
  ok "已创建: $ENDPOINT_FILE"
fi

# ============================================================================
# Step 3: 在 index.ts 中注册
# ============================================================================
info "Step 3/8: 在 index.ts 中注册"

IMPORT_LINE="import { ${CONST_NAME} } from \"./endpoints/${FILE_NAME}.js\";"

if $DRY_RUN; then
  echo "  将在 index.ts 的 //$BATCH 注释下添加 import:"
  echo "    $IMPORT_LINE"
  echo "  将在 ALL_PROVIDERS 数组对应位置添加: ${CONST_NAME}"
else
  if grep -q "^// $BATCH" "$INDEX_FILE"; then
    sed -i "/^\/\/ $BATCH/a\\${IMPORT_LINE}" "$INDEX_FILE"
  elif [[ "$BATCH" == "B1" ]]; then
    sed -i "/import { MINIMAX }/a\\${IMPORT_LINE}" "$INDEX_FILE"
  else
    warn "未找到批次注释 //$BATCH, 将 import 追加到文件末尾"
    echo "$IMPORT_LINE" >> "$INDEX_FILE"
  fi

  TMP_FILE=$(mktemp)
  case "$BATCH" in
    B1) sed "s/\bWENXIN,/WENXIN, ${CONST_NAME},/" "$INDEX_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$INDEX_FILE" ;;
    B2) sed "s/\bINTERNLM,/INTERNLM, ${CONST_NAME},/" "$INDEX_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$INDEX_FILE" ;;
    B3) sed "s/\bAI360,/AI360, ${CONST_NAME},/" "$INDEX_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$INDEX_FILE" ;;
    B4) sed "s/\bGITHUB_COPILOT,/GITHUB_COPILOT, ${CONST_NAME},/" "$INDEX_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$INDEX_FILE" ;;
    B6) sed "s/\bASTRON_CODING_PLAN,/ASTRON_CODING_PLAN, ${CONST_NAME},/" "$INDEX_FILE" > "$TMP_FILE" && mv "$TMP_FILE" "$INDEX_FILE" ;;
  esac

  ok "已在 index.ts 中注册 ${CONST_NAME}"
fi

# ============================================================================
# Step 4: 更新 providers-group.test.ts
# ============================================================================
info "Step 4/8: 更新 providers-group.test.ts"

if $DRY_RUN; then
  echo "  将在 byGroup(\"$GROUP\") 的数组中添加: \"$ID\""
else
  python3 -c "
import re, sys

with open('$GROUP_TEST', 'r') as f:
    content = f.read()

pattern = r'(expect\(byGroup\(\"$GROUP\"\)\)\.toEqual\(\[\s*)(.*?)(\s*\]\.sort\(\)\);)'
match = re.search(pattern, content, re.DOTALL)
if not match:
    print('ERROR: 未找到 byGroup(\"$GROUP\") 的断言', file=sys.stderr)
    sys.exit(1)

items_str = match.group(2)
items = [s.strip().strip('\"').strip(',') for s in items_str.split('\"') if s.strip() and s.strip() not in ['', ',']]
items.append('$ID')
items.sort()

if len(items) <= 6:
    new_items = ', '.join(f'\"{i}\"' for i in items)
else:
    lines = []
    for i in range(0, len(items), 5):
        chunk = items[i:i+5]
        lines.append('      ' + ', '.join(f'\"{c}\"' for c in chunk))
    new_items = ',\n'.join(lines) + ','

replacement = match.group(1) + '\n' + new_items + '\n    ' + match.group(3)
content = content[:match.start()] + replacement + content[match.end():]

with open('$GROUP_TEST', 'w') as f:
    f.write(content)
" || warn "自动更新 group test 失败, 请手动添加 \"$ID\" 到 byGroup(\"$GROUP\") 数组"

  ok "已更新 providers-group.test.ts"
fi

# ============================================================================
# Step 5: 更新 providers-schema.test.ts
# ============================================================================
info "Step 5/8: 更新 providers-schema.test.ts"

CURRENT_NON_CODING=$(grep -oP 'nonCoding\.length\)\.toBe\(\K\d+' "$SCHEMA_TEST")
CURRENT_TOTAL=$(grep -oP 'getAllEndpoints\(\)\.length\)\.toBe\(\K\d+' "$SCHEMA_TEST")

if [[ "$GROUP" != "codingPlan" ]]; then
  NEW_NON_CODING=$((CURRENT_NON_CODING + 1))
else
  NEW_NON_CODING=$CURRENT_NON_CODING
fi
NEW_TOTAL=$((CURRENT_TOTAL + 1))

if $DRY_RUN; then
  echo "  将在 $BATCH 批次收录测试中添加: \"$ID\""
  echo "  将更新 nonCoding 计数: $CURRENT_NON_CODING -> $NEW_NON_CODING"
  echo "  将更新总 provider 计数: $CURRENT_TOTAL -> $NEW_TOTAL"
else
  python3 -c "
import re

with open('$SCHEMA_TEST', 'r') as f:
    content = f.read()

batch_map = {
    'B1': 'moonshot',
    'B2': 'spark',
    'B3': 'modelscope',
    'B4': 'ollama',
    'B6': 'kimiCodingPlan',
}
anchor = batch_map.get('$BATCH')
if not anchor:
    print('WARNING: 无法确定批次锚点', file=__import__('sys').stderr)
else:
    pattern = r'(for \(const id of \[)(.*?)(\])'
    for match in re.finditer(pattern, content, re.DOTALL):
        if anchor in match.group(0):
            items_str = match.group(2)
            items = [s.strip().strip('\"').strip(',') for s in items_str.split('\"') if s.strip() and s.strip() not in ['', ',']]
            items.append('$ID')
            new_items = ', '.join(f'\"{i}\"' for i in items)
            replacement = match.group(1) + new_items + match.group(3)
            content = content[:match.start()] + replacement + content[match.end():]
            break

with open('$SCHEMA_TEST', 'w') as f:
    f.write(content)
" || warn "自动更新批次收录测试失败, 请手动添加 \"$ID\""

  python3 -c "
import re

with open('$SCHEMA_TEST', 'r') as f:
    content = f.read()

batch_desc_map = {
    'B1': r'中国原厂批次 1 全部收录（(\d+) 个）',
    'B2': r'中国原厂批次 2 全部收录（(\d+) 个）',
    'B3': r'中国原厂批次 3 全部收录（(\d+) 个',
    'B4': r'海外/本地/自定义/聚合/GH 全部收录（(\d+) 个）',
    'B6': r'CodingPlan (\d+) 个 provider 全部收录',
}
desc_pattern = batch_desc_map.get('$BATCH')
if desc_pattern:
    match = re.search(desc_pattern, content)
    if match:
        old_count = int(match.group(1))
        new_count = old_count + 1
        content = content[:match.start(1)] + str(new_count) + content[match.end(1):]

with open('$SCHEMA_TEST', 'w') as f:
    f.write(content)
" || warn "自动更新批次计数失败, 请手动更新"

  TMP_FILE=$(mktemp)
  sed "s/expect(nonCoding\.length)\.toBe($CURRENT_NON_CODING)/expect(nonCoding.length).toBe($NEW_NON_CODING)/" "$SCHEMA_TEST" > "$TMP_FILE" && mv "$TMP_FILE" "$SCHEMA_TEST"

  TMP_FILE=$(mktemp)
  sed "s/expect(getAllEndpoints()\.length)\.toBe($CURRENT_TOTAL)/expect(getAllEndpoints().length).toBe($NEW_TOTAL)/" "$SCHEMA_TEST" > "$TMP_FILE" && mv "$TMP_FILE" "$SCHEMA_TEST"

  TMP_FILE=$(mktemp)
  sed "s/= $CURRENT_NON_CODING（不含/= $NEW_NON_CODING（不含/" "$SCHEMA_TEST" > "$TMP_FILE" && mv "$TMP_FILE" "$SCHEMA_TEST"
  TMP_FILE=$(mktemp)
  sed "s/= $CURRENT_TOTAL ($CURRENT_NON_CODING base/= $NEW_TOTAL ($NEW_NON_CODING base/" "$SCHEMA_TEST" > "$TMP_FILE" && mv "$TMP_FILE" "$SCHEMA_TEST"

  ok "已更新 providers-schema.test.ts (nonCoding: $CURRENT_NON_CODING->$NEW_NON_CODING, total: $CURRENT_TOTAL->$NEW_TOTAL)"
fi

# ============================================================================
# Step 6: 更新 studio server.test.ts
# ============================================================================
info "Step 6/8: 更新 studio server.test.ts"

CURRENT_BANK=$(grep -oP 'bank\.length\)\.toBe\(\K\d+' "$STUDIO_TEST")

CURRENT_GROUP_COUNT=$(python3 -c "
import re
with open('$STUDIO_TEST', 'r') as f:
    content = f.read()
match = re.search(r'filter\(.*group === \"$GROUP\"\).*toHaveLength\((\d+)\)', content)
print(match.group(1) if match else '0')
")

NEW_BANK=$((CURRENT_BANK + 1))
NEW_GROUP_COUNT=$((CURRENT_GROUP_COUNT + 1))

if $DRY_RUN; then
  echo "  将在 endpointIdsByGroup.$GROUP 数组中添加: \"$ID\""
  echo "  将更新 bank 计数: $CURRENT_BANK -> $NEW_BANK"
  echo "  将更新 $GROUP group 计数: $CURRENT_GROUP_COUNT -> $NEW_GROUP_COUNT"
else
  python3 -c "
import re

with open('$STUDIO_TEST', 'r') as f:
    content = f.read()

if '$GROUP' == 'overseas':
    pattern = r'(overseas:\s*\[)(.*?)(\])'
else:
    pattern = r'($GROUP:\s*\[)(.*?)(\])'

match = re.search(pattern, content, re.DOTALL)
if match:
    items_str = match.group(2)
    items = [s.strip().strip('\"').strip(',') for s in items_str.split('\"') if s.strip() and s.strip() not in ['', ',']]
    items.append('$ID')
    items.sort()
    new_items = ', '.join(f'\"{i}\"' for i in items)
    replacement = match.group(1) + new_items + match.group(3)
    content = content[:match.start()] + replacement + content[match.end():]

with open('$STUDIO_TEST', 'w') as f:
    f.write(content)
" || warn "自动更新 studio endpointIdsByGroup 失败, 请手动添加 \"$ID\""

  TMP_FILE=$(mktemp)
  sed "s/expect(bank\.length)\.toBe($CURRENT_BANK)/expect(bank.length).toBe($NEW_BANK)/" "$STUDIO_TEST" > "$TMP_FILE" && mv "$TMP_FILE" "$STUDIO_TEST"

  TMP_FILE=$(mktemp)
  python3 -c "
import re

with open('$STUDIO_TEST', 'r') as f:
    content = f.read()

pattern = r'(filter\(.*group === \"$GROUP\"\).*toHaveLength\()(\d+)(\))'
match = re.search(pattern, content)
if match:
    content = content[:match.start(2)] + str($NEW_GROUP_COUNT) + content[match.end(2):]

with open('$STUDIO_TEST', 'w') as f:
    f.write(content)
" || warn "自动更新 studio group 计数失败, 请手动更新"

  ok "已更新 studio server.test.ts (bank: $CURRENT_BANK->$NEW_BANK, $GROUP: $CURRENT_GROUP_COUNT->$NEW_GROUP_COUNT)"
fi

# ============================================================================
# Step 7: 编译 core 包
# ============================================================================
info "Step 7/8: 编译 core 包 (pnpm -F @actalk/inkos-core build)"

if $DRY_RUN; then
  echo "  将执行: cd $PROJECT_ROOT && pnpm -F @actalk/inkos-core build"
else
  BUILD_OUTPUT=$(cd "$PROJECT_ROOT" && pnpm -F @actalk/inkos-core build 2>&1) && BUILD_RC=0 || BUILD_RC=$?
  if [[ $BUILD_RC -eq 0 ]]; then
    ok "编译成功"
  else
    err "编译失败 (exit $BUILD_RC):\n$BUILD_OUTPUT"
  fi
fi

# ============================================================================
# Step 8: 运行 provider 相关测试
# ============================================================================
info "Step 8/8: 运行 provider 测试 (providers-group + providers-schema)"

if $DRY_RUN; then
  echo "  将执行: cd $PROJECT_ROOT/packages/core && npx vitest run providers-group.test.ts providers-schema.test.ts"
else
  TEST_OUTPUT=$(cd "$PROJECT_ROOT/packages/core" && npx vitest run \
    src/__tests__/providers-group.test.ts \
    src/__tests__/providers-schema.test.ts 2>&1) && TEST_RC=0 || TEST_RC=$?
  if [[ $TEST_RC -eq 0 ]]; then
    ok "provider 测试全部通过"
  else
    warn "provider 测试有失败, 请检查输出:\n$TEST_OUTPUT"
  fi
fi

# ============================================================================
# 完成
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
ok "服务商 '$ID' ($LABEL) 已添加完成!"
echo ""
echo "后续可能需要手动完成的步骤:"
echo ""
echo "  1. [必做] 填写官网/控制台/API文档链接 (文件头部注释):"
echo "     $ENDPOINT_FILE"
echo ""
if [[ -z "$COPY_MODELS_FROM" && -z "$PROBE_MODELS" && -z "$MODELS_FILE" ]]; then
echo "  2. [必做] 编辑端点文件, 填写模型列表 (当前为 TODO 占位符):"
echo "     $ENDPOINT_FILE"
echo ""
fi
echo "  3. [可选] 如需 knownModels / piProvider / 特殊 providerFamily,"
echo "     在 service-presets.ts 的 SERVICE_PRESETS 中添加条目:"
echo "     $PROJECT_ROOT/packages/core/src/llm/service-presets.ts"
echo ""
echo "  4. [可选] 如模型 id 可能与其他服务商重复 (如 deepseek-chat),"
echo "     在 lookup.ts 的 PROVIDER_PRIORITY 中添加 '$ID':"
echo "     $LOOKUP_FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
