import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const releaseVersion = "1.4.1";

function readProjectFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath: string): { version?: string } {
  return JSON.parse(readProjectFile(relativePath)) as { version?: string };
}

describe("release metadata", () => {
  it("bumps every package manifest to the migrated upstream release", () => {
    const manifests = [
      "package.json",
      "packages/core/package.json",
      "packages/cli/package.json",
      "packages/studio/package.json",
    ];

    for (const manifest of manifests) {
      expect(readJson(manifest).version, manifest).toBe(releaseVersion);
    }
  });

  it("keeps the upstream 1.4 release notes ahead of the existing fork changelog", () => {
    const changelog = readProjectFile("CHANGELOG.md");

    expect(changelog).toContain("## v1.4.1");
    expect(changelog).toContain("writing.reviewRetries");
    expect(changelog).toContain("## v1.4.0");
    expect(changelog).toContain("短篇写作与 Studio Chat 协作");
    expect(changelog.indexOf("## v1.4.1")).toBeLessThan(changelog.indexOf("## v1.4.0"));
    expect(changelog.indexOf("## v1.4.0")).toBeLessThan(changelog.indexOf("## v1.3.10"));
  });

  it("documents short fiction, cover, and review retry workflows in the readmes", () => {
    const zh = readProjectFile("README.md");
    const en = readProjectFile("README.en.md");
    const ja = readProjectFile("README.ja.md");

    expect(zh).toContain("InkOS Short");
    expect(zh).toContain("inkos short run");
    expect(zh).toContain("covers/<标题>/cover-prompt.md");
    expect(zh).toContain("writing.reviewRetries");
    expect(zh).toContain("inkos-short-demo-cover.png");

    expect(en).toContain("InkOS Short");
    expect(en).toContain("inkos short run");
    expect(en).toContain("writing.reviewRetries");
    expect(en).toContain("cover-prompt.md");

    expect(ja).toContain("inkos short run");
    expect(ja).toContain("writing.reviewRetries");
    expect(ja).toContain("cover-prompt.md");

    expect(existsSync(join(repoRoot, "assets/inkos-short-demo-cover.png"))).toBe(true);
  });
});
