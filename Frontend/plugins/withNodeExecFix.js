const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Patches app/build.gradle after expo prebuild generates it.
 *
 * Problem: the generated nodeExec closure calls List.execute() with bare args.
 * On Linux (EAS), the Gradle daemon's PATH doesn't include node, so the command
 * returns an empty string → new File("").getParentFile() → null → crash.
 *
 * Fix: prepend /usr/bin/env on Linux/Mac so the OS resolves node from PATH.
 */
module.exports = function withNodeExecFix(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    const fixedBlock = [
      'def isWindows = System.getProperty("os.name").toLowerCase().contains("windows")',
      'def nodeExec = { args ->',
      '    def cmd = isWindows ? (["cmd", "/c"] + args) : (["/usr/bin/env"] + args)',
      '    return cmd.execute(null, rootDir).text.trim()',
      '}',
    ].join('\n');

    // Handle all variants the template might generate:
    // 1. No isWindows, just: def nodeExec = { args -> return args.execute(...) }
    // 2. isWindows check but Linux branch is bare args (not wrapped in env)
    const pattern = /(?:def isWindows[^\n]*\n)?def nodeExec = \{ args ->[\s\S]*?\n\}/;

    if (pattern.test(contents)) {
      contents = contents.replace(pattern, fixedBlock);
      console.log('[withNodeExecFix] Patched nodeExec in app/build.gradle ✓');
    } else {
      console.warn('[withNodeExecFix] nodeExec pattern not found — manual review needed');
    }

    config.modResults.contents = contents;
    return config;
  });
};
