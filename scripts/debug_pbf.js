/**
 * Debug PBF parsing
 */

const fs = require('fs');

function debugPBF() {
    console.log('=== Debugging PBF Parsing ===');

    const pbfPath = 'C:\\Users\\sunhao\\Desktop\\ToWatch\\APNS-385ch.restored.pbf';
    console.log('PBF path:', pbfPath);

    try {
        // Read as buffer first
        const buffer = fs.readFileSync(pbfPath);
        console.log('File size:', buffer.length);

        // Check BOM
        console.log('First 4 bytes (hex):', buffer.slice(0, 4).toString('hex'));

        // Try different encodings
        console.log('\\n=== Trying UTF-16LE ===');
        try {
            const utf16Content = buffer.toString('utf16le');
            console.log('First 200 chars (UTF-16LE):');
            console.log(utf16Content.substring(0, 200).replace(/[\\x00-\\x1F\\x7F]/g, '.'));
        } catch (error) {
            console.error('UTF-16LE failed:', error.message);
        }

        console.log('\\n=== Trying UTF-8 ===');
        try {
            const utf8Content = buffer.toString('utf8');
            console.log('First 200 chars (UTF-8):');
            console.log(utf8Content.substring(0, 200).replace(/[\\x00-\\x1F\\x7F]/g, '.'));
        } catch (error) {
            console.error('UTF-8 failed:', error.message);
        }

        // Manual search for bookmark patterns
        console.log('\\n=== Manual Pattern Search ===');
        const textContent = buffer.toString('utf16le').replace(/\\x00/g, '');
        console.log('Text content length:', textContent.length);

        // Look for common patterns
        const bookmarkPatterns = [
            /\\d+(.*?)=\\d+(.*?)\\*(.*?)\\*/g,
            /bookmark/i,
            /书签/g,
            /\\d+=[0-9]+/g
        ];

        bookmarkPatterns.forEach((pattern, index) => {
            const matches = textContent.match(pattern);
            console.log(`Pattern ${index + 1} (${pattern}): Found ${matches ? matches.length : 0} matches`);
            if (matches && matches.length > 0) {
                matches.slice(0, 3).forEach((match, i) => {
                    console.log(`  Match ${i + 1}: ${match.substring(0, 100)}...`);
                });
            }
        });

    } catch (error) {
        console.error('Failed to read PBF:', error.message);
    }
}

// Run debug
debugPBF();