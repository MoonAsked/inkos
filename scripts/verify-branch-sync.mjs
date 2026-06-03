#!/usr/bin/env node

/**
 * Verify that a target branch contains the complete, committed history of a
 * source branch and that no uncommitted worktree changes are being treated as
 * synchronized functionality.
 *
 * Usage:
 *   node scripts/verify-branch-sync.mjs [source-ref] [target-ref]
 *   node scripts/verify-branch-sync.mjs origin/master HEAD \
 *     --source-worktree ../inkos_master
 */

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function fail(message, details = "") {
  process.stderr.write(`FAIL: ${message}\n`);
  if (details) {
    process.stderr.write(`${details.trimEnd()}\n`);
  }
  process.exit(1);
}

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
  });

  if (result.error) {
    fail(`Could not run git ${args.join(" ")}`, result.error.message);
  }

  if (result.status !== 0 && !options.allowFailure) {
    fail(
      `git ${args.join(" ")} exited with status ${result.status}`,
      result.stderr || result.stdout,
    );
  }

  return result;
}

function resolveCommit(ref, cwd) {
  return runGit(["rev-parse", "--verify", `${ref}^{commit}`], { cwd }).stdout.trim();
}

function worktreeStatus(cwd) {
  return runGit(["status", "--porcelain=v1", "--untracked-files=all"], { cwd }).stdout.trimEnd();
}

function printUsage() {
  process.stdout.write(
    "Usage: node scripts/verify-branch-sync.mjs [source-ref] [target-ref] [--source-worktree <path>]\n",
  );
}

const positional = [];
let sourceWorktree;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--help" || arg === "-h") {
    printUsage();
    process.exit(0);
  }
  if (arg === "--source-worktree") {
    sourceWorktree = process.argv[++i];
    if (!sourceWorktree) {
      fail("--source-worktree requires a path");
    }
    continue;
  }
  if (arg.startsWith("-")) {
    fail(`Unknown option: ${arg}`);
  }
  positional.push(arg);
}

if (positional.length > 2) {
  fail("Expected at most source-ref and target-ref positional arguments");
}

const sourceRef = positional[0] ?? "origin/master";
const targetRef = positional[1] ?? "HEAD";
const sourceCommit = resolveCommit(sourceRef);
const targetCommit = resolveCommit(targetRef);
const headCommit = resolveCommit("HEAD");

if (targetCommit !== headCommit) {
  fail(`Target ref ${targetRef} must resolve to the current HEAD (${headCommit})`);
}

const targetStatus = worktreeStatus();
if (targetStatus) {
  fail("Target worktree contains changes without a commit record", targetStatus);
}

if (sourceWorktree) {
  const sourcePath = resolve(sourceWorktree);
  const sourceStatus = worktreeStatus(sourcePath);
  if (sourceStatus) {
    fail(`Source worktree ${sourcePath} contains uncommitted changes`, sourceStatus);
  }

  const sourceHead = resolveCommit("HEAD", sourcePath);
  if (sourceHead !== sourceCommit) {
    fail(
      `Source worktree HEAD ${sourceHead} does not match ${sourceRef} ${sourceCommit}`,
      "Fetch or check out the intended source commit before syncing.",
    );
  }
}

const ancestry = runGit(["merge-base", "--is-ancestor", sourceCommit, targetCommit], {
  allowFailure: true,
});

if (ancestry.status !== 0) {
  const missingCount = runGit(["rev-list", "--count", `${targetCommit}..${sourceCommit}`]).stdout.trim();
  const missingLog = runGit([
    "log",
    "--date=iso-strict",
    "--pretty=format:%H%x09%ad%x09%s",
    `${targetCommit}..${sourceCommit}`,
  ]).stdout;
  fail(
    `Target ${targetRef} is missing ${missingCount} committed source changes from ${sourceRef}`,
    missingLog,
  );
}

const sourceCount = runGit(["rev-list", "--count", sourceCommit]).stdout.trim();
const targetCount = runGit(["rev-list", "--count", targetCommit]).stdout.trim();
const [targetOnly, sourceOnly] = runGit([
  "rev-list",
  "--left-right",
  "--count",
  `${targetCommit}...${sourceCommit}`,
]).stdout.trim().split(/\s+/);
const targetLog = runGit([
  "log",
  "-1",
  "--date=iso-strict",
  "--pretty=format:%H%x09%ad%x09%s",
  targetCommit,
]).stdout.trim();

process.stdout.write(`OK: source ${sourceRef} ${sourceCommit} (${sourceCount} reachable commits)\n`);
process.stdout.write(`OK: target ${targetRef} ${targetCommit} (${targetCount} reachable commits)\n`);
process.stdout.write(`OK: source-only commits=${sourceOnly}; target-only commits=${targetOnly}\n`);
process.stdout.write("OK: target worktree is clean and all source commits are traceable\n");
process.stdout.write(`HEAD: ${targetLog}\n`);
