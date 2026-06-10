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

function getCandidateBinPaths(settings = {}, options = {}) {
  return [
    getConfiguredFFmpegBinPath(settings),
    ...(options.defaultBinPaths || [])
  ].filter(isUsableBinPath);
}

function isUsableBinPath(binPath) {
  if (!binPath) {
    return false;
  }

  return !String(binPath).toLowerCase().includes('.asar');
}

function getFFmpegToolPath(settings = {}, toolName, options = {}) {
  const normalizedToolName = toolName.toLowerCase().endsWith('.exe') ? toolName : `${toolName}.exe`;
  const candidateBinPaths = getCandidateBinPaths(settings, options);

  for (const binPath of candidateBinPaths) {
    const toolPath = path.join(binPath, normalizedToolName);
    if (fs.existsSync(toolPath)) {
      return toolPath;
    }
  }

  return toolName;
}

function getPathKey(env = process.env) {
  return Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'PATH';
}

function getFFmpegToolEnvironment(settings = {}, baseEnv = process.env, options = {}) {
  const binPath = getCandidateBinPaths(settings, options).find((candidatePath) => fs.existsSync(candidatePath));
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
  isUsableBinPath,
  getFFmpegToolPath,
  getFFmpegToolEnvironment,
  mergeFFmpegSettingsForSave,
  quoteCommandPath
};
