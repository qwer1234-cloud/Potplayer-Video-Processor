const http = require('http');

// VLC HTTP接口测试
function testVLCAPI() {
  const options = {
    hostname: 'localhost',
    port: 8080,
    path: '/requests/status.json',
    method: 'GET',
    auth: ':' // 如果没有设置密码，留空
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const status = JSON.parse(data);
        console.log('=== VLC播放器状态 ===');
        console.log(`播放状态: ${status.state}`);
        console.log(`当前时间: ${status.time} 秒`);
        console.log(`总时长: ${status.length} 秒`);
        console.log(`播放位置: ${(status.position * 100).toFixed(2)}%`);

        // 转换为HH:MM:SS格式
        const formatTime = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = Math.floor(seconds % 60);
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };

        console.log(`格式化时间: ${formatTime(status.time)}`);
        console.log(`格式化总时长: ${formatTime(status.length)}`);

      } catch (error) {
        console.error('解析JSON失败:', error.message);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('请求失败:', error.message);
    console.log('请确保:');
    console.log('1. VLC正在运行并启用了HTTP接口');
    console.log('2. 端口8080没有被占用');
    console.log('3. 没有设置密码或密码正确');
  });

  req.end();
}

// 执行测试
testVLCAPI();