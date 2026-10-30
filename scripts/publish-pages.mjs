import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Manual Pages publishing for accounts whose GitHub token cannot upload workflows.
const directory = await mkdtemp(path.join(tmpdir(), "equities-pages-"));
const index = path.join(directory, "index");
const env = { ...process.env, GIT_INDEX_FILE: index };
function git(args) {
  return execFileSync("git", args, { env, encoding: "utf8" }).trim();
}
try {
  await writeFile("dist/.nojekyll", "");
  const remote = spawnSync(
    "git",
    ["ls-remote", "--exit-code", "--heads", "origin", "gh-pages"],
    { encoding: "utf8" },
  );
  if (remote.status !== 0 && remote.status !== 2)
    throw new Error(remote.stderr || "Could not inspect the Pages branch");
  let parent;
  if (remote.status === 0) {
    git([
      "fetch",
      "--depth=1",
      "origin",
      "gh-pages:refs/remotes/origin/gh-pages",
    ]);
    parent = git(["rev-parse", "refs/remotes/origin/gh-pages"]);
  }
  git(["read-tree", "--empty"]);
  git(["add", "--force", "dist"]);
  const tree = git(["write-tree"]);
  const root = git(["rev-parse", `${tree}:dist`]);
  const commit = git([
    "commit-tree",
    root,
    ...(parent ? ["-p", parent] : []),
    "-m",
    "Publish verified Equities build",
  ]);
  execFileSync(
    "git",
    [
      "-c",
      "credential.helper=",
      "-c",
      "credential.helper=!gh auth git-credential",
      "push",
      "origin",
      `${commit}:refs/heads/gh-pages`,
    ],
    { env, stdio: "inherit" },
  );
} finally {
  await unlink(index).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  await rmdir(directory);
}
