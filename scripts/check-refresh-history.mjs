#!/usr/bin/env node
/**
 * Protect published-but-unmerged forecast/thesis records before replacing the
 * bot's refresh branch. Read its ledgers only; never check out or merge its code.
 * A pending ledger must be an identical prefix of the checked-out base ledger.
 * If it contains additional or conflicting history, a maintainer must merge or
 * reconcile that PR first. The captured SHA also guards the eventual push.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

const branch = "chore/scheduled-fixture-refresh";
const remoteRef = `refs/heads/${branch}`;
const ledgerPaths = ["src/data/events/forecast-ledger.json", "src/data/events/thesis-ledger.json"];

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch {
    throw new Error(`Cannot inspect refresh history (git ${args[0]} failed). Check origin access and retry; the refresh branch has not been changed.`);
  }
}

function ledger(text, label) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error(`${label} is not valid JSON. Reconcile the existing refresh PR before rerunning.`); }
  if (!Array.isArray(value)) throw new Error(`${label} is not a ledger array. Reconcile the existing refresh PR before rerunning.`);
  return value;
}

try {
  const head = git(["ls-remote", "--heads", "origin", remoteRef]);
  const remoteSha = head.split(/\s+/)[0] ?? "";
  if (remoteSha) {
    if (!/^[a-f0-9]{40,64}$/.test(remoteSha)) throw new Error("Unexpected refresh branch reference; refresh stopped without changing it.");
    // Fetch exactly the inspected commit, so a concurrent branch update cannot
    // change which records are compared. No branch code enters this checkout.
    git(["fetch", "--no-tags", "origin", remoteSha]);
    for (const file of ledgerPaths) {
      const pending = ledger(git(["show", `${remoteSha}:${file}`]), `Pending ${file}`);
      const current = ledger(readFileSync(file, "utf8"), `Current ${file}`);
      if (pending.length > current.length || pending.some((record, index) => !isDeepStrictEqual(record, current[index]))) {
        throw new Error(`${branch} contains unmerged or conflicting records in ${file}. Merge or reconcile the existing refresh PR first, preserving its ledger records, then rerun. No forecasts were regenerated and the remote branch is unchanged.`);
      }
    }
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `expected_remote_sha=${remoteSha}\n`);
  console.log(remoteSha ? "Refresh history is already preserved in the base checkout; replacement is safe with the captured lease." : "No existing refresh branch; publication will require that it remains absent.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Refresh history check failed.");
  process.exitCode = 1;
}
