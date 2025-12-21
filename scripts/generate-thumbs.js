const path = require('path');
const fs = require('fs');
const sharp = (() => {
  try { return require('sharp'); } catch (e) { return null; }
})();
const sqlite3 = require('sqlite3').verbose();

if (!sharp) {
  console.error('sharp module not found. Please run `npm install sharp` before running this script.');
  process.exit(2);
}

const DB = path.join(__dirname, '..', 'pastebin.db');
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

const RESIZED_MAX_WIDTH = 1200;
const THUMB_MAX_WIDTH = 400;

const db = new sqlite3.Database(DB);

function isImageFilename(fn) {
  const ext = path.extname(fn || '').toLowerCase();
  return ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.bmp', '.svg'].includes(ext);
}

async function processRow(row) {
  return new Promise(async (resolve) => {
    try {
      if (!row || !row.filename) return resolve({ok:false,reason:'no-file'});
      if (!isImageFilename(row.filename)) return resolve({ok:false,reason:'not-image'});
      if (row.resized_filename && row.thumb_filename) return resolve({ok:false,reason:'already'});

      const ext = path.extname(row.filename);
      const id = path.basename(row.filename, ext);
      const origPath = path.join(UPLOAD_DIR, row.filename);
      if (!fs.existsSync(origPath)) return resolve({ok:false,reason:'missing-file'});

      const resizedFilename = id + '-resized' + ext;
      const thumbFilename = id + '-thumb' + ext;
      const resizedPath = path.join(UPLOAD_DIR, resizedFilename);
      const thumbPath = path.join(UPLOAD_DIR, thumbFilename);

      // generate resized (no upscale)
      await sharp(origPath, { failOnError: false }).resize({ width: RESIZED_MAX_WIDTH, withoutEnlargement: true }).toFile(resizedPath);
      await sharp(origPath, { failOnError: false }).resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true }).toFile(thumbPath);

      db.run('UPDATE files SET resized_filename = ?, thumb_filename = ? WHERE id = ?', [resizedFilename, thumbFilename, row.id], err => {
        if (err) return resolve({ok:false,reason:'db',err});
        resolve({ok:true, id: row.id});
      });
    } catch (e) {
      resolve({ok:false,reason:'error',err:e && e.message});
    }
  });
}

function run() {
  console.log('Starting migration: generate resized/thumb for images...');
  db.serialize(() => {
    db.all('SELECT id, filename, resized_filename, thumb_filename FROM files', [], async (err, rows) => {
      if (err) {
        console.error('DB error:', err);
        process.exit(1);
      }
      let total = 0, done = 0, skipped = 0, failed = 0;
      for (const row of rows) {
        total++;
        // eslint-disable-next-line no-await-in-loop
        const r = await processRow(row);
        if (r.ok) {
          done++;
          console.log('Processed', r.id);
        } else {
          skipped++;
          console.log('Skipped', row.id, r.reason || r.err || 'unknown');
        }
      }
      console.log('Migration complete. Total:', total, 'processed:', done, 'skipped:', skipped, 'failed:', failed);
      db.close();
    });
  });
}

run();
