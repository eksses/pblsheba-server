const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');


if (process.env.CLOUDINARY_URL) {
  
  
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
