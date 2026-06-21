import { v2 as cloudinary } from "cloudinary";

import sharp from "sharp";

import streamifier from "streamifier";

/*
|--------------------------------------------------------------------------
| UPLOAD IMAGE
|--------------------------------------------------------------------------
*/

export const uploadImage = async (
  file,
  folder = "housing-system/gallery"
) => {
  if (!file) {
    throw new Error("No file uploaded");
  }

  /*
  |--------------------------------------------------------------------------
  | COMPRESS IMAGE
  |--------------------------------------------------------------------------
  */

  const compressedBuffer = await sharp(file.buffer)
    .resize({
      width: 1400,
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 80,
    })
    .toBuffer();

  /*
  |--------------------------------------------------------------------------
  | UPLOAD TO CLOUDINARY
  |--------------------------------------------------------------------------
  */

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        resolve(result);
      }
    );

    streamifier
      .createReadStream(compressedBuffer)
      .pipe(stream);
  });
};

/*
|--------------------------------------------------------------------------
| DELETE IMAGE
|--------------------------------------------------------------------------
*/

export const deleteImage = async (publicId) => {
  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId);
};