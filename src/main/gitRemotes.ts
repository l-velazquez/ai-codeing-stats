import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";
import { parseGithubRemote } from "../shared/projectRepos";

const execFileAsync = promisify(execFile);
const MAX_PATHS = 300;
const CONCURRENCY = 8;
const CACHE_TTL = 30 * 60_000;

const cache = new Map<string, { repo: string | null; at: number }>();

async function remoteFor(path: string): Promise<string | null> {
  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.repo;
  let repo: string | null = null;
  try {
    const { stdout } = await execFileAsync("git", ["-C", path, "remote", "get-url", "origin"], { timeout: 3_000 });
    repo = parseGithubRemote(stdout);
  } catch {
    // Not a git checkout, no origin, a deleted folder, or git is missing.
  }
  cache.set(path, { repo, at: Date.now() });
  return repo;
}

/**
 * owner/name of the GitHub origin for each workspace path, or null. Only reads
 * the remote URL -- no network access and nothing about the working tree.
 */
export async function githubRemotes(paths: unknown): Promise<Record<string, string | null>> {
  if (!Array.isArray(paths)) throw new Error("A list of workspace paths is required.");
  const unique = [...new Set(paths.filter((path): path is string => typeof path === "string" && isAbsolute(path)))].slice(0, MAX_PATHS);
  const result: Record<string, string | null> = {};
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, unique.length) }, async () => {
    while (cursor < unique.length) {
      const path = unique[cursor++];
      result[path] = await remoteFor(path);
    }
  }));
  return result;
}
