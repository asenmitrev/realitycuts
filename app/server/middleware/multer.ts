import multer from 'multer';
import path from 'path';
import { LIBRARY_IMPORT_MAX_ZIP_BYTES } from '../config/const';

export const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/data',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = Date.now().toString();
      const filename_full = `${filename}${ext}`;
      cb(null, filename_full);
    }
  })
});

/**
 * Dedicated instance for library backup uploads (manifest.json + one or more part
 * ZIPs, uploaded together as a multi-file form). Each file is capped individually so
 * one upload can't exhaust local disk.
 */
export const libraryImportUpload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/data',
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filename_full = `${filename}${ext}`;
      cb(null, filename_full);
    }
  }),
  limits: { fileSize: LIBRARY_IMPORT_MAX_ZIP_BYTES }
});
