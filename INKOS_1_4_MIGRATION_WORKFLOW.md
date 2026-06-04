# InkOS 1.4 Feature Migration Workflow

Source repository: `../inkos` (`1d725b1`, upstream `inkos` 1.4.1+)
Target repository: `.` (`f10449f`, `inkos_master`)

The target fork has independent changes around import continuation, thinking-model
output recovery, SENSENOVA/opencode providers, and chapter splitting. This
migration keeps those fork changes and ports upstream features in traceable,
tested slices.

## Rules

1. Work on `migrate/inkos-1.4-features`.
2. Migrate one feature slice at a time.
3. Run the narrowest relevant tests after each slice.
4. Commit only after the slice passes its relevant tests.
5. Do not squash feature commits during the migration.

## Feature Slices

1. `writing.reviewRetries`
   - Add upstream long-form review retry configuration.
   - Verify config parsing, CLI config set, and pipeline wiring.

2. Provider reliability and service updates
   - Add transient HTTP retry for 429/502/503/504.
   - Bring MiniMax OpenAI-compatible routing fixes.
   - Add kkaiapi provider metadata without removing fork-only providers.

3. Short fiction core and CLI
   - Add standalone short fiction agents, prompts, pipeline runner, and
     `inkos short run`.
   - Verify parser/pipeline/CLI tests.

4. Cover generation core and Studio config API
   - Add cover provider presets, cover artifact generation, and Studio cover
     config/secret endpoints.
   - Verify core cover tests and Studio API tests.

5. Studio Chat integration
   - Add `short_fiction_run` and `generate_cover` tools to agent sessions.
   - Render generated cover previews and tool cards in Chat.
   - Preserve project session/tool details where upstream changed behavior.

6. Documentation and release metadata
   - Update README/changelog/package versions only after code slices are green.

## Commit Message Pattern

- `feat(config): migrate writing review retries`
- `fix(llm): migrate transient retry and service presets`
- `feat(short): migrate short fiction workflow`
- `feat(cover): migrate cover generation`
- `feat(studio): migrate short fiction chat tools`
- `docs: document migrated upstream 1.4 features`
