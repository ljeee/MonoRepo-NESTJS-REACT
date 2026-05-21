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

    // Patch hermesCommand to use the hermes-compiler package, which ships binaries for
    // all platforms (linux64-bin, osx-bin, win64-bin). The react-native package no longer
    // includes hermesc binaries on Windows local installs, so pointing to hermes-compiler
    // is more reliable across environments.
    const hermesCommandReplacement = '    hermesCommand = new File(nodeExec(["node", "--print", "require.resolve(\'hermes-compiler/package.json\')"])).getParentFile().getAbsolutePath() + "/hermesc/%OS-BIN%/hermesc"';
    if (/hermesCommand\s*=/.test(contents)) {
      contents = contents.replace(
        /[ \t]*hermesCommand\s*=[^\n]+/,
        hermesCommandReplacement
      );
      console.log('[withNodeExecFix] Fixed hermesCommand → hermes-compiler ✓');
    }

    // Embed the JS bundle in all variants (including debug) so the APK works standalone
    // without a running Metro server. Essential for installing on physical devices.
    if (!contents.includes('debuggableVariants')) {
      contents = contents.replace(
        /(autolinkLibrariesWithApp\(\))/,
        'debuggableVariants = [] // embed JS bundle in all builds\n    $1'
      );
      console.log('[withNodeExecFix] Added debuggableVariants = [] ✓');
    }

    // Fix hermesc execute permissions: npm on Windows strips +x bits from binaries.
    // When EAS unpacks on Linux, hermesc lacks the execute bit → Gradle crashes with
    // "A problem occurred starting process 'command '...hermesc''".
    // Append a configureEach block that chmod +x's hermesc before any bundle task runs.
    const chmodBlock = `
tasks.configureEach { task ->
    if (task.name.startsWith("createBundle") && task.name.endsWith("JsAndAssets")) {
        task.doFirst {
            try {
                def rnPkg = nodeExec(["node", "--print", "require.resolve('react-native/package.json')"])
                if (rnPkg) {
                    def hermescDir = new File(new File(rnPkg).parentFile, "sdks/hermesc")
                    if (hermescDir.exists()) {
                        hermescDir.eachFileRecurse { f ->
                            if (f.name == "hermesc") { f.setExecutable(true, false) }
                        }
                        println("[withNodeExecFix] chmod +x hermesc done at: " + hermescDir)
                    }
                }
            } catch (Exception e) {
                println("[withNodeExecFix] chmod warning: " + e.message)
            }
        }
    }
}
`;
    if (!contents.includes('hermesc") { f.setExecutable')) {
      contents = contents + chmodBlock;
      console.log('[withNodeExecFix] Added hermesc chmod+x task ✓');
    }

    config.modResults.contents = contents;
    return config;
  });
};
