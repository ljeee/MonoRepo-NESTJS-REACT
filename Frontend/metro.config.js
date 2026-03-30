const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");
const path = require('path');

// 1. Encontrar la raíz del monorepo
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// 2. Configurar Metro para que "mire" la raíz del monorepo y las node_modules compartidas
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Forzar la resolución de semver usando resolveRequest (El método más potente)
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
  // Dejar que el resolver por defecto maneje el resto
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.disableHierarchicalLookup = true;

// Add support for .app.tsx and .app.ts extensions
config.resolver.sourceExts.push('app.tsx', 'app.ts');

module.exports = withNativewind(config, {
  inlineVariables: false,
  globalClassNamePolyfill: false,
});
