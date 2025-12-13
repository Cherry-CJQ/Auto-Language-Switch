const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sidecarDir = path.resolve(__dirname, '../native-sidecar');
const targetDir = path.join(__dirname, 'bin');
const exeName = process.platform === 'win32' ? 'als-sidecar.exe' : 'als-sidecar';

console.log('Building native-sidecar...');
try {
    execSync('cargo build --release', { cwd: sidecarDir, stdio: 'inherit' });
} catch (e) {
    console.error('Build failed.');
    process.exit(1);
}

const srcPath = path.join(sidecarDir, 'target/release', exeName);
const destPath = path.join(targetDir, exeName);

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

console.log(`Copying ${srcPath} to ${destPath}...`);
fs.copyFileSync(srcPath, destPath);
console.log('Done.');
