import { cp, mkdir, access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workspaceRoot = process.cwd();
const targetDir = process.argv[2] || process.env.OBSIDIAN_PLUGIN_DIR;

if (!targetDir) {
  console.error("Missing target plugin directory.");
  console.error("Usage: npm run deploy -- \"D:/YourVault/.obsidian/plugins/daily-dashboard\"");
  console.error("Or set OBSIDIAN_PLUGIN_DIR to that folder path.");
  process.exit(1);
}

const requiredFiles = ["main.js", "manifest.json", "styles.css"];
for (const fileName of requiredFiles) {
  const fullPath = path.join(workspaceRoot, fileName);
  try {
    await access(fullPath);
  } catch {
    console.error(`Required file missing: ${fullPath}`);
    console.error("Run npm run build and ensure the plugin package files exist before deploying.");
    process.exit(1);
  }
}

await mkdir(targetDir, { recursive: true });

for (const fileName of requiredFiles) {
  await cp(path.join(workspaceRoot, fileName), path.join(targetDir, fileName), { force: true });
}

const wallpapersSource = path.join(workspaceRoot, "Wallpapers");
try {
  await access(wallpapersSource);
  await cp(wallpapersSource, path.join(targetDir, "Wallpapers"), {
    recursive: true,
    force: true
  });
} catch {
  // Wallpapers are optional for deployment.
}

console.log(`Deployed plugin files to ${targetDir}`);
