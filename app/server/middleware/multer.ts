import multer from 'multer';
import path from 'path';

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
