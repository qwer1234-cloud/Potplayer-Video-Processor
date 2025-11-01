// Test the actual PBF parsing logic with real file content

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

  // Test multiple regex patterns
  console.log('Testing different regex patterns...\n');

  // Pattern 1: Original pattern
  console.log('Pattern 1: /(\d+)=(\d+)\*书签\s*(\d+)\*/g');
  const potPlayerPBFRegex1 = /(\d+)=(\d+)\*书签\s*(\d+)\*/g;
  let match;
  let count1 = 0;
  while ((match = potPlayerPBFRegex1.exec(content)) !== null) {
    count1++;
    console.log(`  Match ${count1}: index=${match[1]}, timestamp=${match[2]}, bookmark=${match[3]}`);
  }
  console.log(`Pattern 1 found ${count1} matches\n`);

  // Pattern 2: More flexible pattern
  console.log('Pattern 2: /(\d+)=(\d+)\*[^=]*\*/g');
  const potPlayerPBFRegex2 = /(\d+)=(\d+)\*[^=]*\*/g;
  let count2 = 0;
  while ((match = potPlayerPBFRegex2.exec(content)) !== null) {
    count2++;
    console.log(`  Match ${count2}: index=${match[1]}, timestamp=${match[2]}, full=${match[0].substring(0, 50)}...`);
  }
  console.log(`Pattern 2 found ${count2} matches\n`);

  // Pattern 3: Line by line parsing
  console.log('Pattern 3: Line by line parsing');
  const lines = content.split('\n');
  let count3 = 0;
  lines.forEach((line, index) => {
    if (line.includes('=') && line.includes('书签')) {
      count3++;
      const parts = line.split('=');
      if (parts.length >= 2) {
        const index = parts[0];
        const rest = parts[1];
        const timestampMatch = rest.match(/(\d+)\*/);
        if (timestampMatch) {
          const timestamp = timestampMatch[1];
          console.log(`  Line ${index}: index=${index}, timestamp=${timestamp}`);
        }
      }
    }
  });
  console.log(`Pattern 3 found ${count3} matches\n`);

  return count2 > 0 ? count2 : 0;
}

// Read and test the actual PBF file
try {
  const pbfPath = 'D:\\ProcessVideo-Beta\\HMN-421-C.pbf';
  console.log(`Reading PBF file: ${pbfPath}`);

  if (fs.existsSync(pbfPath)) {
    const content = fs.readFileSync(pbfPath, 'utf8');
    console.log(`File size: ${content.length} characters`);
    console.log(`First 200 characters: ${content.substring(0, 200)}`);

    const bookmarkCount = parseBookmarkContent(content);
    console.log(`\nTotal bookmarks found: ${bookmarkCount}`);

    if (bookmarkCount > 0) {
      console.log('✅ PBF parsing should work!');
    } else {
      console.log('❌ PBF parsing failed - need to fix the regex pattern');
    }
  } else {
    console.log('❌ PBF file not found');
  }
} catch (error) {
  console.error('Error reading PBF file:', error);
}