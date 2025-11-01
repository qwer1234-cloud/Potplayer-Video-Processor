// Test script to verify timestamp conversion logic

function convertTimestampToTime(timestamp) {
  // PotPlayer timestamp is in milliseconds, convert to HH:MM:SS.mmm
  const totalSeconds = Math.floor(timestamp / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = timestamp % 1000;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

// Test the conversion
const timestamps = [1617814, 1623315, 1655085, 1658257];

console.log('Testing timestamp conversion:');
timestamps.forEach((timestamp, index) => {
  const timeString = convertTimestampToTime(timestamp);
  console.log(`Timestamp ${timestamp} → ${timeString}`);
});

// Test regex pattern for PBF format
const testLine = "0=1617814*书签 1*2800000048000000480000000100200004000000B60900000000000000000000000000000000000000000000";
const regex = /(\d+)=(\d+)\*书签\s*(\d+)\*/;
const match = testLine.match(regex);

console.log('\nTesting PBF regex:');
if (match) {
  console.log(`Index: ${match[1]}`);
  console.log(`Timestamp: ${match[2]}`);
  console.log(`Bookmark Number: ${match[3]}`);
  console.log('✅ Regex pattern works correctly!');
} else {
  console.log('❌ Regex pattern failed');
}