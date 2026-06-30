import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    // cloud_name: process.env.CLOUDINARY_CLOUD_NAME+,
    // api_key: process.env.CLOUDINARY_API_KEY,
    // api_secret: process.env.CLOUDINARY_API_SECRET,
    cloud_name: "dwv3hqktb",
    api_key: "644745652752952",
    api_secret: "b_rYnyZeKpVbo8QZPp7tJ2cKi8Y"
});

export default cloudinary;