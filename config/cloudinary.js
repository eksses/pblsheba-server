const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'pblsheba_members',
    // Removing strict allowed_formats to avoid 'unknown format' errors on some platforms
    // Cloudinary will handle format validation on its end.
    resource_type: 'auto',
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
