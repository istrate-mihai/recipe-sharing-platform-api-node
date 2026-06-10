// src/middleware/upload.js
import multer from 'multer';

const storage = multer.memoryStorage();

const imageFilter = (_req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'));
  }
  cb(null, true);
};

// Vue frontend sends images as images[0][file], images[1][file], etc.
// We use .any() to capture all fields, then normalize to req.files array.
const _anyUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
}).any();

export function uploadImages(req, res, next) {
  _anyUpload(req, res, (err) => {
    if (err) return next(err);

    // Normalize: pull out only image files (fieldname matches images[N][file])
    if (req.files?.length) {
      req.files = req.files.filter(f => f.fieldname.startsWith('images['));
    }

    // Extract existing image IDs sent as images[N][id] from req.body
    const imageIds = [];
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        const match = key.match(/^images\[(\d+)\]\[id\]$/);
        if (match) imageIds.push(req.body[key]);
      });
    }
    req.imageIds = imageIds;

    // Steps sent as steps[0], steps[1], etc. — collect into array
    if (!Array.isArray(req.body.steps)) {
      const steps = [];
      Object.keys(req.body).forEach(key => {
        const match = key.match(/^steps\[(\d+)\]$/);
        if (match) steps[Number(match[1])] = req.body[key];
      });
      if (steps.length) req.body.steps = steps;
    }

    // Ingredients sent as ingredients[0][name], etc. — collect into array
    if (!Array.isArray(req.body.ingredients)) {
      const ingredients = [];
      Object.keys(req.body).forEach(key => {
        const match = key.match(/^ingredients\[(\d+)\]\[(\w+)\]$/);
        if (match) {
          const idx   = Number(match[1]);
          const field = match[2];
          if (!ingredients[idx]) ingredients[idx] = {};
          ingredients[idx][field] = req.body[key];
        }
      });
      if (ingredients.length) req.body.ingredients = ingredients;
    }

    // nutritional_info sent as nutritional_info[calories], etc.
    if (!req.body.nutritional_info || typeof req.body.nutritional_info === 'string') {
      const nutri = {};
      Object.keys(req.body).forEach(key => {
        const match = key.match(/^nutritional_info\[(\w+)\]$/);
        if (match) nutri[match[1]] = req.body[key];
      });
      if (Object.keys(nutri).length) req.body.nutritional_info = nutri;
    }

    next();
  });
}

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
}).single('avatar');
