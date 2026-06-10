const assert = require('assert');
const path = require('path');
const {
  parsePBFBookmarks,
  parseBookmarkContent,
  convertTimestampToTime,
  convertTimeToSeconds,
  convertSecondsToTime
} = require('./core/pbf-parser');

async function run() {
  assert.strictEqual(convertTimestampToTime(1617814), '00:26:57.814');
  assert.strictEqual(convertTimeToSeconds('00:26:57.814'), 1617.814);
  assert.strictEqual(convertSecondsToTime(1617.814), '00:26:57.814');

  const bookmarks = await parsePBFBookmarks(path.join(__dirname, 'HMN-421-C.pbf'));
  assert.ok(bookmarks.length >= 14, 'parses PotPlayer bookmark rows from an actual PBF file');
  assert.deepStrictEqual(
    bookmarks.slice(0, 3).map(bookmark => bookmark.index),
    [0, 1, 2],
    'sorts parsed PotPlayer bookmarks by their index'
  );
  assert.strictEqual(bookmarks[0].time, '00:26:57.814');

  const inlineBookmarks = parseBookmarkContent('timestamp:00:00:10.000 name:start\\ntimestamp:00:00:12.500 name:end');
  assert.deepStrictEqual(
    inlineBookmarks.map(bookmark => bookmark.time),
    ['00:00:10.000', '00:00:12.500'],
    'parses simple timestamp/name bookmark content'
  );
}

run()
  .then(() => console.log('Core PBF parser tests passed'))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
