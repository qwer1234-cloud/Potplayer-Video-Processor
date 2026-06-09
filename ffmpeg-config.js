const fs = require('fs');
const path = require('path');

function getPathValue(settings = {}) {
  return (settings.ffmpegPath || settings.ffmpegBinPath || '').trim();
}

function hasExecutableExtension(filePath) {
  return path.extname(filePath).toLowerCase() === '.exe';
}

function getConfiguredFFmpegBinPath(settings = {}) {
  const configuredPath = getPathValue(settings);
  if (!configuredPath) {
    return '';
  }

  if (hasExecutableExtension(configuredPath)) {
    return path.dirname(configuredPath);
  }

  return configuredPath;
}

function getFFmpegToolPath(settings = {}, toolName) {
  const normalizedToolName = toolName.toLowerCase().endsWith('.exe') ? toolName : `${toolName}.exe`;
  const binPath = getConfiguredFFmpegBinPath(settings);
  if (!binPath) {
    return toolName;
  }

  const toolPath = path.join(binPath, normalizedToolName);
  return fs.existsSync(toolPath) ? toolPath : toolName;
}

function getPathKey(env = process.env) {
  return Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
}

function getFFmpegToolEnvironment(settings = {}, baseEnv = process.env) {
  const binPath = getConfiguredFFmpegBinPath(settings);
  if (!binPath) {
    return baseEnv;
  }

  const env = { ...baseEnv };
  const pathKey = getPathKey(env);
  const existingPath = env[pathKey] || '';
  const pathParts = existingPath.split(path.delimiter).filter(Boolean);
  const alreadyPresent = pathParts.some((entry) => entry.trim().replace(/[\\/]$/, '').toLowerCase() === binPath.replace(/[\\/]$/, '').toLowerCase());

  if (!alreadyPresent) {
    env[pathKey] = existingPath ? `${binPath}${path.delimiter}${existingPath}` : binPath;
  }

  return env;
}

function quoteCommandPath(commandPath) {
  if (!commandPath || !/[\\/\s]/.test(commandPath)) {
    return commandPath;
  }

  return `"${commandPath.replace(/"/g, '\\"')}"`;
}

function mergeFFmpegSettingsForSave(existingSettings = {}, incomingSettings = {}) {
  const mergedSettings = { ...incomingSettings };
  const incomingPath = getPathValue(incomingSettings);
  const existingPath = getPathValue(existingSettings);

  if (incomingPath) {
    mergedSettings.ffmpegPath = incomingPath;
  } else if (existingPath) {
    mergedSettings.ffmpegPath = existingPath;
  }

  if (existingSettings.lastSelectionPaths && !incomingSettings.lastSelectionPaths) {
    mergedSettings.lastSelectionPaths = existingSettings.lastSelectionPaths;
  }

  return mergedSettings;
}

module.exports = {
  getConfiguredFFmpegBinPath,
  getFFmpegToolPath,
  getFFmpegToolEnvironment,
  mergeFFmpegSettingsForSave,
  quoteCommandPath
};
