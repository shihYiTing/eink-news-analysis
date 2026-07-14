function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

module.exports = { readStdin };
