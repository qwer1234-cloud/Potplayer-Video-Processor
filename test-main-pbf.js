// Test the main.js PBF parsing logic directly

const fs = require('fs');

function convertTimestampToTime(timestamp) {
  const totalSeconds = Math.floor(timestamp / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = timestamp % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

function parseBookmarkContent(content) {
  const bookmarks = [];

  // Format 1: PotPlayer PBF format (序号=时间戳*书签 书签号*...)
  // Use a more flexible regex to handle different character encodings
  const potPlayerPBFRegex = /(\d+)=(\d+)\*[^=]*\*/g;
  let match;

  console.log(`Testing regex: ${potPlayerPBFRegex}`);
  console.log(`Content length: ${content.length}`);
  console.log(`First 300 chars: ${JSON.stringify(content.substring(0, 300))}`);

  while ((match = potPlayerPBFRegex.exec(content)) !== null) {
    console.log(`Found match: ${match[0]}`);
    const index = parseInt(match[1]);
    const timestamp = parseInt(match[2]);
    const fullMatch = match[0];

    // Try to extract bookmark number from the full match
    let bookmarkNumber = '';
    const bookmarkMatch = fullMatch.match(/书签\s*(\d+)/);
    if (bookmarkMatch) {
      bookmarkNumber = bookmarkMatch[1];
    } else {
      bookmarkNumber = (index + 1).toString();
    }

    // Convert timestamp to HH:MM:SS.mmm format
    const timeString = convertTimestampToTime(timestamp);

    bookmarks.push({
      index: index,
      timestamp: timestamp,
      time: timeString,
      name: `书签 ${bookmarkNumber}`,
      originalLine: fullMatch
    });
  }

  // Sort bookmarks by index to ensure correct order
  bookmarks.sort((a, b) => a.index - b.index);
  return bookmarks;
}

// Read and test the actual PBF file
try {
  const pbfPath = 'D:\\ProcessVideo-Beta\\HMN-421-C.pbf';
  console.log(`Reading PBF file: ${pbfPath}`);

  if (fs.existsSync(pbfPath)) {
    // Read exactly like main.js does
    let content;
    try {
      const buffer = fs.readFileSync(pbfPath);
      content = buffer.toString('utf16le');
      console.log(`Reading PBF file with UTF-16LE encoding`);
    } catch (utf16Error) {
      content = fs.readFileSync(pbfPath, 'utf8');
      console.log(`Reading PBF file with UTF-8 encoding (fallback)`);
    }

    console.log(`File size: ${content.length} characters`);

    const bookmarks = parseBookmarkContent(content);
    console.log(`\nTotal bookmarks found: ${bookmarks.length}`);

    if (bookmarks.length > 0) {
      console.log('✅ PBF parsing works!');
      bookmarks.forEach((bookmark, i) => {
        console.log(`  ${i+1}: Index ${bookmark.index}, Time ${bookmark.time}, Name ${bookmark.name}`);
      });
    } else {
      console.log('❌ PBF parsing failed');
    }
  } else {
    console.log('❌ PBF file not found');
  }
} catch (error) {
  console.error('Error:', error);
}