import React, { useState } from "react";
import { noticesDummyData } from "../../assets/assets";
import Title from "../../components/Title";
import { motion } from "framer-motion";

const ManageNotices = () => {
  const [notices, setNotices] = useState(noticesDummyData);
  const [formData, setFormData] = useState({
    _id: null,
    title: "",
    date: "",
    summary: "",
    content: "",
    image: "",
  });

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
      console.log("Update notice:", formData);
      setNotices(notices.map((n) => (n._id === formData._id ? { ...formData, createdAt: new Date().toISOString() } : n)));
    } else {
      console.log("Add notice:", formData);
      setNotices([
        ...notices,
        { ...formData, _id: `notice_${notices.length + 1}`.padStart(3, "0"), createdAt: new Date().toISOString() },
      ]);
    }
    setFormData({ _id: null, title: "", date: "", summary: "", content: "", image: "" });
  };

  const handleEdit = (notice) => {
    setFormData(notice);
  };

  const handleDelete = (id) => {
    console.log("Delete notice:", id);
    setNotices(notices.filter((n) => n._id !== id));
  };

  return (
    <div className="w-full bg-white">
      <Title
        title="Manage Notices"
        subTitle="Create, edit, or remove community notices."
      />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white border border-gray-300 rounded-md p-6 shadow-sm"
        >
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
            {formData._id ? "Edit Notice" : "Add New Notice"}
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
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Summary</label>
              <input
                type="text"
                name="summary"
                value={formData.summary}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Content</label>
              <textarea
                name="content"
                value={formData.content}
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
                  onClick={() => setFormData({ _id: null, title: "", date: "", summary: "", content: "", image: "" })}
                  className="bg-gray-500 text-white rounded-md py-2 px-4 font-outfit hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-2 bg-white border border-gray-300 rounded-md p-6 shadow-sm"
        >
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Notice List</h3>
          <div className="space-y-4">
            {notices.map((notice) => (
              <div
                key={notice._id}
                className="p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)] transition-all"
              >
                <div className="flex gap-4">
                  {notice.image && (
                    <img src={notice.image} alt={notice.title} className="h-24 w-24 object-cover rounded-md" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-playfair text-base font-semibold text-gray-800">{notice.title}</h4>
                    <p className="text-gray-600 font-outfit">{notice.date} | Created: {new Date(notice.createdAt).toLocaleDateString()}</p>
                    <p className="text-gray-600 font-outfit">{notice.summary}</p>
                    <p className="text-gray-600 font-outfit mt-1">{notice.content}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEdit(notice)}
                        className="text-[var(--color-primary)] hover:underline font-outfit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(notice._id)}
                        className="text-red-500 hover:underline font-outfit"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ManageNotices;