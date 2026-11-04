// Small helpers around Cloudinary so image clean-up never crashes a request.
const destroyImage = async (filename) => {
  if (!filename || typeof filename !== "string") return;
  try {
    const { cloudinary } = require("../cloudConfig");
    await cloudinary.v2.uploader.destroy(filename);
  } catch (e) {
    console.error("Could not remove image from Cloudinary:", e && e.message);
  }
};

// multer-storage-cloudinary uploads before we validate, so a rejected form must delete its upload.
const discardUpload = (file) => (file && file.public_id ? destroyImage(file.public_id) : Promise.resolve());

module.exports = { destroyImage, discardUpload };
