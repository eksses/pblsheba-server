const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure cloudinary explicitly if CLOUDINARY_URL doesn't auto-resolve
if (process.env.CLOUDINARY_URL) {
  // It handles it automatically by the package, but we can also set config explicitly
  // cloudinary.config() will pick it up
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pblsheba_members',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
