const fs = require('fs');

async function parsePBFBookmarks(pbfFilePath) {
  if (!fs.existsSync(pbfFilePath)) {
    throw new Error(`PBF file not found: ${pbfFilePath}`);
  }

  const buffer = fs.readFileSync(pbfFilePath);
  const candidates = [buffer.toString('utf16le'), buffer.toString('utf8')];

  for (const content of candidates) {
    const bookmarks = parseBookmarkContent(content);
    if (bookmarks.length > 0) {
      return bookmarks;
    }
  }

  throw new Error('No bookmarks found in PBF file');
}

function parseBookmarkContent(content) {
  const bookmarks = [];
  const lines = content.split('\n');

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (line.startsWith('//') || line.startsWith('#') || line === '' || line === '[Bookmark]') {
      continue;
    }

    const match = /^(\d+)=(\d+)\*([^*]*)\*/.exec(line);
    if (match) {
      const index = parseInt(match[1], 10);
      const timestamp = parseInt(match[2], 10);

      bookmarks.push({
        index,
        timestamp,
        time: convertTimestampToTime(timestamp),
        name: match[3] || `书签 ${index + 1}`,
        originalLine: line
      });
    }
  }

  bookmarks.sort((a, b) => a.index - b.index);
  if (bookmarks.length > 0) {
    return bookmarks;
  }

  const potPlayerRegex = /timestamp:(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s+name:(.+?)(?=\s*timestamp:|$)/gis;
  let match;
  while ((match = potPlayerRegex.exec(content)) !== null) {
    bookmarks.push({
      time: match[1],
      name: match[2].trim(),
      originalLine: match[0]
    });
  }

  if (bookmarks.length > 0) {
    return bookmarks;
  }

  const simpleRegex = /(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s+(.+)/gi;
  while ((match = simpleRegex.exec(content)) !== null) {
    bookmarks.push({
      time: match[1],
      name: match[2].trim(),
      originalLine: match[0]
    });
  }

  if (bookmarks.length > 0) {
    return bookmarks;
  }

  try {
    const jsonData = JSON.parse(content);
    if (Array.isArray(jsonData)) {
      jsonData.forEach(item => {
        if (item.time && item.name) {
          bookmarks.push({
            time: item.time,
            name: item.name,
            originalLine: JSON.stringify(item)
          });
        }
      });
    }
  } catch (error) {
    // Not JSON bookmark content.
  }

  if (bookmarks.length > 0) {
    return bookmarks;
  }

  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const parts = trimmedLine.split(/\s+/);
    if (parts.length >= 2 && /^\d{2}:\d{2}:\d{2}/.test(parts[0])) {
      bookmarks.push({
        time: parts[0],
        name: parts.slice(1).join(' '),
        originalLine: trimmedLine
      });
    }
  });

  return bookmarks;
}

function convertTimestampToTime(timestamp) {
  const totalSeconds = Math.floor(timestamp / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = timestamp % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function convertTimeToSeconds(timeStr) {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const secondsParts = (parts[2] || '0').split('.');
  const seconds = parseInt(secondsParts[0], 10) || 0;
  const milliseconds = parseInt(secondsParts[1], 10) || 0;

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

function convertSecondsToTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

module.exports = {
  parsePBFBookmarks,
  parseBookmarkContent,
  convertTimestampToTime,
  convertTimeToSeconds,
  convertSecondsToTime
};
