const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

const config = getDefaultConfig(projectRoot);

// 1. Watch the workspace root so changes in shared code trigger a reload
config.watchFolders = [workspaceRoot];

// 2. Let Metro resolve packages from the workspace root (where Frontend node_modules might live)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'Frontend', 'node_modules') // In case shared code imports from Frontend
];

// 3. Force Metro to resolve (sub)dependencies from the workspace root if needed
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
