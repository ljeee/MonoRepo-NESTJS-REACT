const { withMainApplication } = require('@expo/config-plugins');

/**
 * Patches MainApplication.kt after expo prebuild generates it.
 *
 * Problem: Expo SDK 55 targets RN 0.83.x and its template omits `reactNativeHost`
 * from MainApplication because RN 0.83 removed it from the ReactApplication interface.
 * However, this project uses react-native 0.81.x where `reactNativeHost` is still
 * an abstract member of ReactApplication → Kotlin compile error.
 *
 * Fix: inject a stub override so the class compiles. The stub is never called at
 * runtime because New Architecture routes everything through `reactHost`.
 */
module.exports = function withMainApplicationFix(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes('override val reactNativeHost')) {
      console.log('[withMainApplicationFix] reactNativeHost already present — skipped');
      return config;
    }

    // 1. Add import (insert before `import com.facebook.react.ReactHost`)
    if (!contents.includes('import com.facebook.react.ReactNativeHost')) {
      contents = contents.replace(
        'import com.facebook.react.ReactHost\n',
        'import com.facebook.react.ReactNativeHost\nimport com.facebook.react.ReactHost\n'
      );
    }

    // 2. Insert the stub property right after the class opening brace
    const classPattern = /(class MainApplication\s*:\s*Application\(\),\s*ReactApplication\s*\{)/;
    if (classPattern.test(contents)) {
      const stub = [
        '',
        '  // Required by ReactApplication in RN 0.81.x; unused in New Architecture (reactHost is used instead).',
        '  override val reactNativeHost: ReactNativeHost',
        '    get() = throw IllegalStateException("New Architecture is enabled — use reactHost instead")',
        '',
      ].join('\n');
      contents = contents.replace(classPattern, `$1${stub}`);
      console.log('[withMainApplicationFix] Added reactNativeHost stub ✓');
    } else {
      console.warn('[withMainApplicationFix] class MainApplication pattern not found — skipped');
    }

    config.modResults.contents = contents;
    return config;
  });
};
