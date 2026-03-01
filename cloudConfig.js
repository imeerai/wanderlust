const cloudinary = require("cloudinary"); 
const cloudinaryStorage = require("multer-storage-cloudinary");

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = cloudinaryStorage({
  cloudinary,
  params: {
    folder: "airbnb-db",
    allowed_formats: ["jpeg", "png", "jpg"],
    resource_type: "image",
  },
});

module.exports = { cloudinary, storage };
