// Test PBF file with different encodings

const fs = require('fs');

function testWithEncoding(encoding) {
  try {
    const pbfPath = 'D:\\ProcessVideo-Beta\\HMN-421-C.pbf';
    console.log(`\nTesting with encoding: ${encoding}`);

    if (fs.existsSync(pbfPath)) {
      const buffer = fs.readFileSync(pbfPath);
      let content;

      if (encoding === 'utf8') {
        content = buffer.toString('utf8');
      } else if (encoding === 'utf16le') {
        content = buffer.toString('utf16le');
      } else {
        content = buffer.toString();
      }

      console.log(`First 500 characters: ${content.substring(0, 500)}`);

      // Test for different patterns
      const patterns = [
        /(\d+)=(\d+)\*.*?\*/g,
        /(\d+)=(\d+)\*/g,
        /=\d+\*/g,
        /bookmark/gi
      ];

      patterns.forEach((pattern, index) => {
        const matches = content.match(pattern);
        console.log(`Pattern ${index + 1} (${pattern}): ${matches ? matches.length : 0} matches`);
        if (matches && matches.length > 0) {
          console.log(`  First match: ${matches[0]}`);
        }
      });

      // Look for hex patterns
      const hexContent = buffer.toString('hex');
      console.log(`Hex start: ${hexContent.substring(0, 100)}`);

    }
  } catch (error) {
    console.error(`Error with ${encoding}:`, error);
  }
}

// Test different encodings
['utf8', 'utf16le', 'ascii'].forEach(testWithEncoding);

// Also test as binary
try {
  const pbfPath = 'D:\\ProcessVideo-Beta\\HMN-421-C.pbf';
  console.log('\nTesting as binary...');

  if (fs.existsSync(pbfPath)) {
    const buffer = fs.readFileSync(pbfPath);
    console.log(`Buffer length: ${buffer.length}`);
    console.log(`First 100 bytes as hex: ${buffer.subarray(0, 100).toString('hex')}`);

    // Look for the pattern we know exists
    const searchString = '0=1617814';
    const searchBytes = Buffer.from(searchString, 'ascii');

    let found = false;
    for (let i = 0; i <= buffer.length - searchBytes.length; i++) {
      if (buffer[i] === searchBytes[0] &&
          buffer[i+1] === searchBytes[1] &&
          buffer[i+2] === searchBytes[2] &&
          buffer[i+3] === searchBytes[3] &&
          buffer[i+4] === searchBytes[4] &&
          buffer[i+5] === searchBytes[5] &&
          buffer[i+6] === searchBytes[6] &&
          buffer[i+7] === searchBytes[7] &&
          buffer[i+8] === searchBytes[8]) {
        found = true;
        console.log(`Found pattern at position ${i}`);
        console.log(`Context: ${buffer.subarray(Math.max(0, i-20), Math.min(buffer.length, i+50)).toString()}`);
        break;
      }
    }

    if (!found) {
      console.log('Pattern not found, trying different approach...');

      // Look for numbers
      const numberPattern = /\d+=\d+/g;
      let textContent = buffer.toString('utf8', 0, 1000); // Just first 1000 chars
      let matches = textContent.match(numberPattern);
      if (matches) {
        console.log(`Found number patterns: ${matches.length}`);
        matches.forEach((match, index) => {
          console.log(`  ${index + 1}: ${match}`);
        });
      }
    }
  }
} catch (error) {
  console.error('Error reading binary:', error);
}