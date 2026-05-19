const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Patches app/build.gradle after expo prebuild generates it.
 *
 * Problem: on Linux (EAS), the Gradle daemon's PATH doesn't include node
 * (which is typically installed via nvm). Any ["node", ...].execute(null, rootDir)
 * call returns an empty string → new File("").getParentFile() → null → crash.
 *
 * The expo SDK 55 template generates inline execute() calls without using /usr/bin/env.
 * This plugin handles two template shapes:
 *   A) Template already has a `def nodeExec = { args -> ... }` function: fix it.
 *   B) Template uses inline ["node", ...].execute(null, rootDir).text.trim() calls:
 *      inject the nodeExec helper and replace all inline calls.
 */
module.exports = function withNodeExecFix(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const fixedHelper = [
      'def isWindows = System.getProperty("os.name").toLowerCase().contains("windows")',
      'def nodeExec = { args ->',
      '    def cmd = isWindows ? (["cmd", "/c"] + args) : (["/usr/bin/env"] + args)',
      '    return cmd.execute(null, rootDir).text.trim()',
      '}',
    ].join('\n');

    if (/def nodeExec\s*=\s*\{/.test(contents)) {
      // Shape A: replace the existing nodeExec closure.
      const pattern = /(?:def isWindows[^\n]*\n)?def nodeExec = \{ args ->[\s\S]*?\n\}/;
      if (pattern.test(contents)) {
        contents = contents.replace(pattern, fixedHelper);
        console.log('[withNodeExecFix] Replaced existing nodeExec closure ✓');
      } else {
        console.warn('[withNodeExecFix] Found nodeExec but pattern mismatch — skipped');
      }
    } else {
      // Shape B: template uses inline ["node", ...].execute(null, rootDir).text.trim().
      // 1. Inject the helper right after def projectRoot.
      if (!contents.includes('def projectRoot')) {
        console.warn('[withNodeExecFix] def projectRoot not found — cannot inject helper');
        config.modResults.contents = contents;
        return config;
      }
      contents = contents.replace(
        /(def projectRoot\s*=[^\n]+)/,
        `$1\n\n${fixedHelper}`
      );

      // 2. Replace every inline call:
      //    ["node", ...].execute(null, rootDir).text.trim()
      //    → nodeExec(["node", ...])
      //
      // Non-greedy (.*?) correctly handles strings that contain "]" (e.g. codegenDir arg).
      const replaced = contents.replace(
        /\["node"(.*?)\]\.execute\(null,\s*rootDir\)\.text\.trim\(\)/gs,
        'nodeExec(["node"$1])'
      );

      const callCount = (contents.match(/\["node".*?\]\.execute\(null,\s*rootDir\)\.text\.trim\(\)/gs) || []).length;
      contents = replaced;
      console.log(`[withNodeExecFix] Injected nodeExec helper, replaced ${callCount} inline call(s) ✓`);
    }

    config.modResults.contents = contents;
    return config;
  });
};
