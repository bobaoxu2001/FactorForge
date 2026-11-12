// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appendRecord } from "./ledger";

const script = path.join(process.cwd(), "scripts/check-refresh-history.mjs");
const branch = "chore/scheduled-fixture-refresh";
const forecastPath = "src/data/events/forecast-ledger.json";
const thesisPath = "src/data/events/thesis-ledger.json";
const temporaryRoots: string[] = [];
type Record = { id: string; value: number; prevHash: string; hash: string };

afterEach(() => { for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "factorforge-refresh-safety-"));
  temporaryRoots.push(root);
  const remote = path.join(root, "remote.git");
  const checkout = path.join(root, "checkout");
  mkdirSync(checkout);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: checkout, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--bare", remote);
  git("init", "-b", "main");
  git("config", "user.name", "Refresh safety test");
  git("config", "user.email", "refresh-test@example.invalid");
  git("config", "commit.gpgsign", "false");
  git("remote", "add", "origin", remote);
  const write = (file: string, records: Record[]) => {
    const output = path.join(checkout, file);
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(records)}\n`);
  };
  const forecast = [appendRecord([], { id: "F-1", value: 1 })];
  const thesis = [appendRecord([], { id: "T-1", value: 1 })];
  write(forecastPath, forecast);
  write(thesisPath, thesis);
  git("add", ".");
  git("commit", "-m", "Base ledgers");
  git("push", "origin", "main");
  const pending = (change: () => void) => {
    git("checkout", "-b", branch);
    change();
    git("add", ".");
    git("commit", "--allow-empty", "-m", "Pending refresh");
    git("push", "origin", branch);
    const sha = git("rev-parse", "HEAD");
    git("checkout", "main");
    return sha;
  };
  const output = path.join(root, "github-output");
  const check = () => spawnSync(process.execPath, [script], { cwd: checkout, env: { ...process.env, GITHUB_OUTPUT: output }, encoding: "utf8" });
  return { git, write, pending, output, check, checkout, forecast, thesis };
}

describe("scheduled refresh history protection", () => {
  it("allows a first refresh with an explicit absent-branch lease", () => {
    const f = fixture();
    expect(f.check().status).toBe(0);
    expect(readFileSync(f.output, "utf8")).toBe("expected_remote_sha=\n");
  });

  it("allows replacing a fixture-only PR and captures its exact remote commit", () => {
    const f = fixture();
    const sha = f.pending(() => writeFileSync(path.join(f.checkout, "pending-fixture.txt"), "new snapshot"));
    expect(f.check().status).toBe(0);
    expect(readFileSync(f.output, "utf8")).toBe(`expected_remote_sha=${sha}\n`);
    expect(f.git("status", "--porcelain")).toBe("");
  });

  it.each([forecastPath, thesisPath])("blocks unmerged records in %s without changing either branch", (file) => {
    const f = fixture();
    const records = file === forecastPath ? f.forecast : f.thesis;
    const sha = f.pending(() => f.write(file, [...records, appendRecord(records, { id: "NEW", value: 2 })]));
    const head = f.git("rev-parse", "HEAD");
    const result = f.check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`unmerged or conflicting records in ${file}`);
    expect(result.stderr).toContain("Merge or reconcile the existing refresh PR first");
    expect(f.git("rev-parse", "HEAD")).toBe(head);
    expect(f.git("ls-remote", "--heads", "origin", `refs/heads/${branch}`)).toContain(sha);
    expect(f.git("status", "--porcelain")).toBe("");
  });

  it("blocks a conflicting chain even when its length matches main", () => {
    const f = fixture();
    f.pending(() => f.write(forecastPath, [appendRecord([], { id: "F-1", value: 999 })]));
    expect(f.check().status).toBe(1);
    expect(f.git("status", "--porcelain")).toBe("");
  });

  it("allows an older remote prefix when its records are already preserved in main", () => {
    const f = fixture();
    f.pending(() => {});
    f.write(forecastPath, [...f.forecast, appendRecord(f.forecast, { id: "F-2", value: 2 })]);
    f.git("add", ".");
    f.git("commit", "-m", "Later main ledger");
    expect(f.check().status).toBe(0);
  });

  it("rejects a publication lease after another process advances the remote branch", () => {
    const f = fixture();
    const before = f.pending(() => {});
    expect(f.check().status).toBe(0);
    f.git("checkout", branch);
    f.git("commit", "--allow-empty", "-m", "Concurrent remote update");
    f.git("push", "origin", branch);
    const concurrent = f.git("rev-parse", "HEAD");
    f.git("checkout", "main");
    f.git("commit", "--allow-empty", "-m", "Prepared next refresh");
    expect(() => f.git("push", `--force-with-lease=refs/heads/${branch}:${before}`, "origin", `HEAD:refs/heads/${branch}`)).toThrow();
    expect(f.git("ls-remote", "--heads", "origin", `refs/heads/${branch}`)).toContain(concurrent);
  });
});
