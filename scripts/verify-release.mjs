import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

async function readJson(relativePath) {
  const fullPath = path.join(root, relativePath);
  const content = await readFile(fullPath, "utf8");
  return JSON.parse(content);
}

async function assertFileExists(relativePath) {
  const fullPath = path.join(root, relativePath);
  const info = await stat(fullPath);
  if (!info.isFile()) {
    throw new Error(`${relativePath} exists but is not a file.`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const manifest = await readJson("manifest.json");
  const packageJson = await readJson("package.json");
  const versions = await readJson("versions.json");

  assert(typeof manifest.version === "string" && manifest.version.trim().length > 0, "manifest.json is missing a valid version.");
  assert(typeof packageJson.version === "string" && packageJson.version.trim().length > 0, "package.json is missing a valid version.");
  assert(manifest.version === packageJson.version, `Version mismatch: manifest.json has ${manifest.version} but package.json has ${packageJson.version}.`);
  assert(typeof manifest.minAppVersion === "string" && manifest.minAppVersion.trim().length > 0, "manifest.json is missing minAppVersion.");
  assert(versions[manifest.version] === manifest.minAppVersion, `versions.json must map ${manifest.version} to ${manifest.minAppVersion}.`);

  const expectedTag = process.env.RELEASE_TAG?.trim() || process.env.GITHUB_REF_NAME?.trim() || "";
  if (expectedTag) {
    assert(expectedTag === manifest.version, `Release tag mismatch: expected ${expectedTag} but manifest.json version is ${manifest.version}.`);
  }

  await assertFileExists("main.js");
  await assertFileExists("manifest.json");
  await assertFileExists("styles.css");

  console.log(`Release verification passed for version ${manifest.version}.`);
}

main().catch((error) => {
  console.error(`Release verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});