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
*/

export const createGalleryItem = async (req, res) => {
  try {
    const { title, description } = req.body;

    const createdBy = req.clerkUserId;

    if (!title || !description || !req.file) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | UPLOAD IMAGE
    |--------------------------------------------------------------------------
    */

    const uploaded = await uploadImage(
      req.file,
      "housing-system/gallery"
    );

    /*
    |--------------------------------------------------------------------------
    | CREATE GALLERY ITEM
    |--------------------------------------------------------------------------
    */

    const item = await Gallery.create({
      title: title.trim(),
      description: description.trim(),
      image: uploaded.secure_url,
      imagePublicId: uploaded.public_id,
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
| UPDATE GALLERY ITEM
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

    let image = oldItem.image;

    let imagePublicId = oldItem.imagePublicId;

    /*
    |--------------------------------------------------------------------------
    | NEW IMAGE UPLOAD
    |--------------------------------------------------------------------------
    */

    if (req.file) {
      /*
      |--------------------------------------------------------------------------
      | DELETE OLD IMAGE
      |--------------------------------------------------------------------------
      */

      await deleteImage(oldItem.imagePublicId);

      /*
      |--------------------------------------------------------------------------
      | UPLOAD NEW IMAGE
      |--------------------------------------------------------------------------
      */

      const uploaded = await uploadImage(
        req.file,
        "housing-system/gallery"
      );

      image = uploaded.secure_url;

      imagePublicId = uploaded.public_id;
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
        image,
        imagePublicId,
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
    | DELETE CLOUDINARY IMAGE
    |--------------------------------------------------------------------------
    */

    await deleteImage(item.imagePublicId);

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