import React, { useState } from "react";
import { membersDummyData } from "../../assets/assets";
import Title from "../../components/Title";

const ManageMembers = () => {
  const [members, setMembers] = useState(membersDummyData);
  const [editingMember, setEditingMember] = useState(null);

  const handleEdit = (member) => {
    setEditingMember({ ...member });
  };

  const handleSave = (e) => {
    e.preventDefault();
    console.log("Save member:", editingMember);
    setMembers(members.map((m) => (m._id === editingMember._id ? editingMember : m)));
    setEditingMember(null);
  };

  const handleDelete = (id) => {
    console.log("Delete member:", id);
    setMembers(members.filter((m) => m._id !== id));
  };

  return (
    <div className="w-full bg-white">
      <Title
        title="Manage Members"
        subTitle="View, edit, or remove member profiles."
      />
      <div className="mt-8">
        {editingMember ? (
          <div className="bg-white border border-gray-300 rounded-md p-6 mb-6 shadow-sm">
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Edit Member</h3>
            <form onSubmit={handleSave}>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Name</label>
                <input
                  type="text"
                  value={editingMember.name}
                  onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Email</label>
                <input
                  type="email"
                  value={editingMember.email}
                  onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Membership Number</label>
                <input
                  type="text"
                  value={editingMember.membershipNumber}
                  onChange={(e) => setEditingMember({ ...editingMember, membershipNumber: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Plot Number</label>
                <input
                  type="text"
                  value={editingMember.plotNumber}
                  onChange={(e) => setEditingMember({ ...editingMember, plotNumber: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Payment Status</label>
                <select
                  value={editingMember.paymentStatus}
                  onChange={(e) => setEditingMember({ ...editingMember, paymentStatus: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="Due">Due</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1 font-outfit">Role</label>
                <select
                  value={editingMember.role}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-outfit hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="bg-gray-500 text-white rounded-md py-2 px-4 font-outfit hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white border border-gray-300 rounded-md p-6 shadow-sm">
            <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Member List</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="py-2 px-4 font-outfit text-gray-600">Name</th>
                    <th className="py-2 px-4 font-outfit text-gray-600">Email</th>
                    <th className="py-2 px-4 font-outfit text-gray-600">Membership No</th>
                    <th className="py-2 px-4 font-outfit text-gray-600">Plot No</th>
                    <th className="py-2 px-4 font-outfit text-gray-600">Payment Status</th>
                    <th className="py-2 px-4 font-outfit text-gray-600">Role</th>
                    <th className="py-2 px-4 font-outfit text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member._id} className="border-b border-gray-200">
                      <td className="py-2 px-4 font-outfit">{member.name}</td>
                      <td className="py-2 px-4 font-outfit">{member.email}</td>
                      <td className="py-2 px-4 font-outfit">{member.membershipNumber}</td>
                      <td className="py-2 px-4 font-outfit">{member.plotNumber}</td>
                      <td className="py-2 px-4 font-outfit">{member.paymentStatus}</td>
                      <td className="py-2 px-4 font-outfit">{member.role}</td>
                      <td className="py-2 px-4 font-outfit flex gap-2">
                        <button
                          onClick={() => handleEdit(member)}
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(member._id)}
                          className="text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageMembers;