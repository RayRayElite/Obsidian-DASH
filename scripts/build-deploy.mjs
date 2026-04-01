import { spawn } from "node:child_process";
import process from "node:process";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

const deployArgs = process.argv.slice(2);
const nodeExecutable = process.execPath;

await run(nodeExecutable, ["esbuild.config.mjs", "production"]);
await run(nodeExecutable, ["scripts/deploy-plugin.mjs", ...deployArgs]);
