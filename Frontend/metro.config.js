const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const path = require('path');

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

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
  return context.resolveRequest(context, moduleName, platform);
};

// Add support for .app.tsx and .app.ts extensions
config.resolver.sourceExts.push('app.tsx', 'app.ts');

module.exports = withNativewind(config, {
  inlineVariables: false,
  globalClassNamePolyfill: false,
});
