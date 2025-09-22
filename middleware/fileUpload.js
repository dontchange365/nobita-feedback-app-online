// middleware/fileUpload.js

const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer in-memory storage, for processing file as a buffer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const newStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        return {
            folder: 'nobita_feedback_avatars',
            // CHANGE START: Public ID ko user ki userId ke roop mein set karein
            public_id: req.user.userId,
            // CHANGE END
            transformation: [{
                width: 150,
                height: 150,
                crop: "fill",
                gravity: "face",
                radius: "max"
            }, {
                quality: "auto:eco"
            }],
        };
    },
});

const newUpload = multer({ storage: newStorage });

module.exports = { upload, cloudinary, newUpload };
