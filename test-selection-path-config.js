const assert = require('assert');
const {
  getRememberedSelectionPath,
  mergeSettingsForSave,
  rememberSelectionPaths
} = require('./selection-path-config');

const defaults = {
  'bookmark-gif': 'D:\\',
  video: 'C:\\Users\\sunhao\\Desktop\\ToWatch',
  '7zip': 'E:\\'
};

assert.strictEqual(
  getRememberedSelectionPath({ lastSelectionPaths: { 'bookmark-gif': 'F:\\pbf' } }, 'bookmark-gif', defaults),
  'F:\\pbf',
  'uses the remembered path for the same operation'
);

assert.strictEqual(
  getRememberedSelectionPath({}, 'video', defaults),
  'C:\\Users\\sunhao\\Desktop\\ToWatch',
  'falls back to the existing default path when no remembered path exists'
);

assert.deepStrictEqual(
  rememberSelectionPaths(
    { lastSelectionPaths: { video: 'C:\\videos' } },
    'bookmark-gif',
    ['D:\\shows\\episode.pbf']
  ).lastSelectionPaths,
  {
    video: 'C:\\videos',
    'bookmark-gif': 'D:\\shows'
  },
  'stores the parent folder after selecting a file'
);

assert.deepStrictEqual(
  rememberSelectionPaths(
    { lastSelectionPaths: { 'bookmark-gif': 'D:\\shows' } },
    '7zip',
    ['E:\\archives\\source']
  ).lastSelectionPaths,
  {
    'bookmark-gif': 'D:\\shows',
    '7zip': 'E:\\archives\\source'
  },
  'stores the folder itself after selecting a directory'
);

assert.deepStrictEqual(
  mergeSettingsForSave(
    { filePath: 'D:\\old.pbf', lastSelectionPaths: { 'bookmark-gif': 'D:\\shows' } },
    { filePath: '2 个PBF文件已选择', format: 'bookmark-gif' }
  ),
  {
    filePath: '2 个PBF文件已选择',
    format: 'bookmark-gif',
    lastSelectionPaths: { 'bookmark-gif': 'D:\\shows' }
  },
  'renderer settings saves preserve remembered dialog paths'
);

console.log('Selection path config tests passed');
