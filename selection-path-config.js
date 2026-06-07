const path = require('path');

const DIRECTORY_SELECTION_FORMATS = new Set(['7zip', 'add-prefix', 'remove-prefix']);

function isDirectorySelection(format) {
  return DIRECTORY_SELECTION_FORMATS.has(format);
}

function getRememberedSelectionPath(settings = {}, format, defaultSelectionPaths = {}) {
  const rememberedPath = settings.lastSelectionPaths && settings.lastSelectionPaths[format];
  if (typeof rememberedPath === 'string' && rememberedPath.trim()) {
    return rememberedPath;
  }

  return defaultSelectionPaths[format] || defaultSelectionPaths.default || '';
}

function getPathToRemember(format, selectedPaths) {
  if (!Array.isArray(selectedPaths) || selectedPaths.length === 0 || !selectedPaths[0]) {
    return null;
  }

  const selectedPath = selectedPaths[0];
  return isDirectorySelection(format) ? selectedPath : path.dirname(selectedPath);
}

function rememberSelectionPaths(settings = {}, format, selectedPaths) {
  const pathToRemember = getPathToRemember(format, selectedPaths);
  if (!pathToRemember) {
    return settings;
  }

  return {
    ...settings,
    lastSelectionPaths: {
      ...(settings.lastSelectionPaths || {}),
      [format]: pathToRemember
    }
  };
}

function mergeSettingsForSave(existingSettings = {}, incomingSettings = {}) {
  const mergedSelectionPaths = {
    ...(existingSettings.lastSelectionPaths || {}),
    ...(incomingSettings.lastSelectionPaths || {})
  };

  const mergedSettings = {
    ...incomingSettings
  };

  if (Object.keys(mergedSelectionPaths).length > 0) {
    mergedSettings.lastSelectionPaths = mergedSelectionPaths;
  }

  return mergedSettings;
}

module.exports = {
  isDirectorySelection,
  getRememberedSelectionPath,
  rememberSelectionPaths,
  mergeSettingsForSave
};
