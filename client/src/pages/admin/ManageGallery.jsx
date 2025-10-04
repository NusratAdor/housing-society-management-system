import React, { useState } from "react";
import { galleryDummyData } from "../../assets/assets";
import Title from "../../components/Title";

const ManageGallery = () => {
  const [gallery, setGallery] = useState(galleryDummyData);
  const [formData, setFormData] = useState({ _id: null, title: "", description: "", image: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setFormData({ ...formData, image: imageUrl });
      console.log("Image selected:", file.name);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData._id) {
      console.log("Update gallery item:", formData);
      setGallery(gallery.map((g) => (g._id === formData._id ? formData : g)));
    } else {
      console.log("Add gallery item:", formData);
      setGallery([...gallery, { ...formData, _id: `${gallery.length + 1}` }]);
    }
    setFormData({ _id: null, title: "", description: "", image: "" });
  };

  const handleEdit = (item) => {
    setFormData(item);
  };

  const handleDelete = (id) => {
    console.log("Delete gallery item:", id);
    setGallery(gallery.filter((g) => g._id !== id));
  };

  return (
    <div className="w-full bg-white">
      <Title
        title="Manage Gallery"
        subTitle="Add, edit, or remove community gallery items."
      />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-300 rounded-md p-6 shadow-sm">
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
            {formData._id ? "Edit Gallery Item" : "Add New Gallery Item"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="4"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              {formData.image && (
                <img src={formData.image} alt="Preview" className="mt-2 h-24 rounded-md" />
              )}
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-outfit hover:bg-blue-700"
              >
                {formData._id ? "Update" : "Add"}
              </button>
              {formData._id && (
                <button
                  type="button"
                  onClick={() => setFormData({ _id: null, title: "", description: "", image: "" })}
                  className="bg-gray-500 text-white rounded-md py-2 px-4 font-outfit hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
        <div className="lg:col-span-2 bg-white border border-gray-300 rounded-md p-6 shadow-sm">
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Gallery List</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {gallery.map((item) => (
              <div
                key={item._id}
                className="p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)]"
              >
                <img src={item.image} alt={item.title} className="h-24 w-full object-cover rounded-md mb-2" />
                <h4 className="font-playfair text-base font-semibold text-gray-800">{item.title}</h4>
                <p className="text-gray-600 font-outfit">{item.description}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="text-[var(--color-primary)] hover:underline font-outfit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="text-red-500 hover:underline font-outfit"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageGallery;