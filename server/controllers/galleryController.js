import Gallery from "../models/Gallery.js";

import Notification from "../models/Notification.js";

import {
  uploadImage,
  deleteImage,
} from "../services/cloudinaryService.js";

/*
|--------------------------------------------------------------------------
| CREATE GALLERY ITEM
|--------------------------------------------------------------------------
| CHANGE: now accepts MULTIPLE files (req.files, from upload.array()
| in the route) instead of a single req.file. All files upload to
| Cloudinary in parallel via Promise.all. images[0] becomes the legacy
| image/imagePublicId "cover" fields, so GalleryCard.jsx and any other
| existing single-image consumers keep working unchanged.
|--------------------------------------------------------------------------
*/

export const createGalleryItem = async (req, res) => {
  try {
    const { title, description } = req.body;

    const createdBy = req.clerkUserId;

    if (!title || !description || !req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and at least one image are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | UPLOAD ALL IMAGES (parallel)
    |--------------------------------------------------------------------------
    */

    const uploadedImages = await Promise.all(
      req.files.map(async (file) => {
        const uploaded = await uploadImage(file, "housing-system/gallery");
        return {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
        };
      })
    );

    /*
    |--------------------------------------------------------------------------
    | CREATE GALLERY ITEM
    |--------------------------------------------------------------------------
    */

    const item = await Gallery.create({
      title: title.trim(),
      description: description.trim(),
      images: uploadedImages,
      // Legacy cover fields — mirror the first uploaded image.
      image: uploadedImages[0].url,
      imagePublicId: uploadedImages[0].publicId,
      createdBy,
    });

    /*
    |--------------------------------------------------------------------------
    | CREATE NOTIFICATION
    |--------------------------------------------------------------------------
    */

    await Notification.create({
      type: "Gallery",
      content: `New gallery item added: ${title}`,
      adminOnly: true,
    });

    return res.status(201).json({
      success: true,
      message: "Gallery item created",
      item,
    });
  } catch (error) {
    console.error(
      "createGalleryItem error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET GALLERY ITEMS
|--------------------------------------------------------------------------
| UNCHANGED — .select("-__v") now also returns the new images array
| automatically, no changes needed here.
|--------------------------------------------------------------------------
*/

export const getGalleryItems = async (req, res) => {
  try {
    const items = await Gallery.find()
      .sort({
        createdAt: -1,
      })
      .select("-__v");

    return res.json({
      success: true,
      gallery: items,
    });
  } catch (error) {
    console.error(
      "getGalleryItems error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET GALLERY ITEM BY ID
|--------------------------------------------------------------------------
| NEW — needed for the gallery detail page (mirrors getNoticeById in
| noticeController.js). Public route, no auth required, same as the
| list endpoint above.
|--------------------------------------------------------------------------
*/

export const getGalleryItemById = async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id).select("-__v");

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Gallery item not found",
      });
    }

    return res.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error(
      "getGalleryItemById error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE GALLERY ITEM
|--------------------------------------------------------------------------
| CHANGE: if new files are uploaded, the ENTIRE existing image set is
| deleted from Cloudinary and replaced with the new set — same "new
| upload replaces everything" convention already used for notice
| attachments in noticeController.js's updateNotice, so this isn't a
| new pattern for the codebase. If no new files are sent, existing
| images are left untouched, same as before.
|
| Handles the pre-migration edge case: an old item that only has legacy
| image/imagePublicId (no images array yet) still gets cleaned up
| correctly when replaced.
|--------------------------------------------------------------------------
*/

export const updateGalleryItem = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title & description required",
      });
    }

    const oldItem = await Gallery.findById(req.params.id);

    if (!oldItem) {
      return res.status(404).json({
        success: false,
        message: "Gallery item not found",
      });
    }

    let images = oldItem.images;

    /*
    |--------------------------------------------------------------------------
    | NEW IMAGES UPLOADED — replace the entire set
    |--------------------------------------------------------------------------
    */

    if (req.files && req.files.length > 0) {
      /*
      |--------------------------------------------------------------------------
      | DELETE ALL OLD IMAGES
      |--------------------------------------------------------------------------
      */

      const oldImages = oldItem.images?.length
        ? oldItem.images
        : (oldItem.imagePublicId ? [{ publicId: oldItem.imagePublicId }] : []);

      await Promise.all(oldImages.map((img) => deleteImage(img.publicId)));

      /*
      |--------------------------------------------------------------------------
      | UPLOAD NEW IMAGES
      |--------------------------------------------------------------------------
      */

      images = await Promise.all(
        req.files.map(async (file) => {
          const uploaded = await uploadImage(file, "housing-system/gallery");
          return {
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
          };
        })
      );
    }

    /*
    |--------------------------------------------------------------------------
    | UPDATE ITEM
    |--------------------------------------------------------------------------
    */

    const updated = await Gallery.findByIdAndUpdate(
      req.params.id,
      {
        title: title.trim(),
        description: description.trim(),
        images,
        image: images[0]?.url || "",
        imagePublicId: images[0]?.publicId || "",
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return res.json({
      success: true,
      message: "Gallery item updated",
      item: updated,
    });
  } catch (error) {
    console.error(
      "updateGalleryItem error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
|--------------------------------------------------------------------------
| DELETE GALLERY ITEM
|--------------------------------------------------------------------------
| CHANGE: deletes ALL images in the set from Cloudinary, not just one.
| Falls back to the legacy single image for pre-migration items that
| don't have an images array yet.
|--------------------------------------------------------------------------
*/

export const deleteGalleryItem = async (req, res) => {
  try {
    const item = await Gallery.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Gallery item not found",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DELETE ALL CLOUDINARY IMAGES
    |--------------------------------------------------------------------------
    */

    const images = item.images?.length
      ? item.images
      : (item.imagePublicId ? [{ publicId: item.imagePublicId }] : []);

    await Promise.all(images.map((img) => deleteImage(img.publicId)));

    /*
    |--------------------------------------------------------------------------
    | DELETE DB RECORD
    |--------------------------------------------------------------------------
    */

    await Gallery.findByIdAndDelete(req.params.id);

    return res.json({
      success: true,
      message: "Gallery item deleted",
    });
  } catch (error) {
    console.error(
      "deleteGalleryItem error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};