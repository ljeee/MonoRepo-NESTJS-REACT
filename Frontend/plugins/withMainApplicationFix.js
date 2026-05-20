const { withMainApplication } = require('@expo/config-plugins');

/**
 * Patches MainApplication.kt after expo prebuild generates it.
 *
 * Problem: Expo SDK 55 targets RN 0.83.x and its template omits `reactNativeHost`
 * from MainApplication because RN 0.83 removed it from the ReactApplication interface.
 * However, this project uses react-native 0.81.x where `reactNativeHost` is still
 * an abstract member of ReactApplication → Kotlin compile error.
 *
 * Additionally, libraries like react-native-screens access `reactNativeHost` at
 * runtime (deprecated but still called in 0.81.x) → a throwing stub causes crashes.
 *
 * Fix: inject a real DefaultReactNativeHost implementation that satisfies the
 * interface and won't crash if called by third-party libraries.
 */
module.exports = function withMainApplicationFix(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes('override val reactNativeHost')) {
      console.log('[withMainApplicationFix] reactNativeHost already present — skipped');
      return config;
    }

    // 1. Add imports
    if (!contents.includes('import com.facebook.react.ReactNativeHost')) {
      contents = contents.replace(
        'import com.facebook.react.ReactHost\n',
        'import com.facebook.react.ReactNativeHost\nimport com.facebook.react.ReactHost\n'
      );
    }
    if (!contents.includes('import com.facebook.react.defaults.DefaultReactNativeHost')) {
      contents = contents.replace(
        'import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint\n',
        'import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint\nimport com.facebook.react.defaults.DefaultReactNativeHost\n'
      );
    }

    // 2. Insert a real DefaultReactNativeHost implementation after the class opening brace.
    //    react-native-screens and other RN 0.81.x code may call reactNativeHost at runtime,
    //    so a throwing stub crashes the app. A proper implementation avoids this.
    const classPattern = /(class MainApplication\s*:\s*Application\(\),\s*ReactApplication\s*\{)/;
    if (classPattern.test(contents)) {
      const impl = [
        '',
        '  // Required by ReactApplication in RN 0.81.x. Some libraries (e.g. react-native-screens)',
        '  // still access this property at runtime even in New Architecture builds.',
        '  override val reactNativeHost: ReactNativeHost by lazy {',
        '    object : DefaultReactNativeHost(this) {',
        '      override fun getPackages(): List<ReactPackage> =',
        '          PackageList(this@MainApplication).packages.apply {}',
        '      override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG',
        '      override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"',
        '    }',
        '  }',
        '',
      ].join('\n');
      contents = contents.replace(classPattern, `$1${impl}`);
      console.log('[withMainApplicationFix] Added DefaultReactNativeHost implementation ✓');
    } else {
      console.warn('[withMainApplicationFix] class MainApplication pattern not found — skipped');
    }

    config.modResults.contents = contents;
    return config;
  });
};
