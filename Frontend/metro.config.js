const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const path = require('path');

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// ─── Block Android/Gradle build directories ───────────────────────────────────
// On Windows, Metro's FallbackWatcher crashes with ENOENT when it tries to watch
// directories inside android/build or node_modules/**/android/build that Gradle
// hasn't created yet. Block all such paths to prevent the crash.
const escRe = (str) => str.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
const androidBuildBlockList = [
  // Local android project build outputs
  path.join(projectRoot, 'android', '.gradle'),
  path.join(projectRoot, 'android', 'app', 'build'),
  path.join(projectRoot, 'android', 'app', '.cxx'),
  path.join(projectRoot, 'android', 'build'),
].map((p) => new RegExp(`^${escRe(p)}`));

// Block node_modules/**/android/build (codegen outputs from native modules like
// react-native-gesture-handler, reanimated, etc.)
const nodeModulesAndroidBuild = new RegExp(
  `^${escRe(path.join(projectRoot, '..', 'node_modules'))}[/\\\\].+[/\\\\]android[/\\\\](build|\.cxx)`
);

config.resolver.blockList = [
  ...(config.resolver.blockList ? [config.resolver.blockList].flat() : []),
  ...androidBuildBlockList,
  nodeModulesAndroidBuild,
];

// Resolve semver shims (workaround for bundler version conflicts)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'semver/functions/satisfies') {
    return {
      filePath: path.resolve(projectRoot, 'shims/semver/functions/satisfies.js'),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'semver/functions/prerelease') {
    return {
      filePath: path.resolve(projectRoot, 'shims/semver/functions/prerelease.js'),
      type: 'sourceFile',
    };
  }
  // nativewind v5 removed jsx-runtime on all platforms — fall back to React's own
  if (moduleName === 'nativewind/jsx-runtime') {
    return context.resolveRequest(context, 'react/jsx-runtime', platform);
  }
  // Web-only: react-native-css's babel plugin rewrites `import { X } from 'react-native'`
  // to `import { X } from 'react-native-css/components/X'`. Each of those modules
  // calls copyComponentProperties(rn.X) at init time, hitting a circular-dep getter
  // in react-native-web 0.21. This barrel shim defers all access to render time.
  // On native, the original files work correctly — no shim needed.
  if (platform === 'web' &&
      moduleName.startsWith('react-native-css/components/') &&
      !moduleName.includes('react-native-safe-area-context')) {
    return {
      filePath: path.resolve(projectRoot, 'shims/react-native-css-components.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Add support for .app.tsx and .app.ts extensions
config.resolver.sourceExts.push('app.tsx', 'app.ts');

module.exports = withNativewind(config, {
  inlineVariables: false,
  globalClassNamePolyfill: false,
});
