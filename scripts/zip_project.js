const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const outputZipPath = path.join(__dirname, '../healthcare-manager.zip');
const output = fs.createWriteStream(outputZipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`📦 Archive healthcare-manager.zip created successfully! (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

const rootDir = path.join(__dirname, '..');

const itemsToInclude = [
  'src',
  'prisma',
  'public',
  'scripts',
  'tests',
  'package.json',
  'tsconfig.json',
  'tsconfig.server.json',
  'vite.config.ts',
  'tailwind.config.js',
  'postcss.config.js',
  'index.html',
  '.env.example',
  'README.md',
  'system_design.md'
];

itemsToInclude.forEach((item) => {
  const itemPath = path.join(rootDir, item);
  if (fs.existsSync(itemPath)) {
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      archive.directory(itemPath, item, (entry) => {
        if (entry.name.includes('node_modules') || entry.name.includes('dist') || entry.name.includes('dev.db')) {
          return false;
        }
        return entry;
      });
    } else {
      archive.file(itemPath, { name: item });
    }
  }
});

archive.finalize();
