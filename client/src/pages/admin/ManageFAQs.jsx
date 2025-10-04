import React, { useState } from "react";
import { faqsDummyData } from "../../assets/assets";
import Title from "../../components/Title";
import { motion } from "framer-motion";

const ManageFAQs = () => {
  const [faqs, setFaqs] = useState(faqsDummyData);
  const [pendingQuestions, setPendingQuestions] = useState([
    { _id: "pending_001", question: "How to book the clubhouse?", askedBy: "Alice Brown", askedAt: "Jul 25, 2025" },
    { _id: "pending_002", question: "What are the parking rules?", askedBy: "Bob Wilson", askedAt: "Jul 26, 2025" },
  ]);
  const [formData, setFormData] = useState({ _id: null, question: "", answer: "", askedBy: "", answeredAt: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAnswer = (question) => {
    setFormData({ _id: null, question: question.question, answer: "", askedBy: question.askedBy, answeredAt: "" });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const answeredAt = new Date().toLocaleDateString();
    if (formData._id) {
      console.log("Update FAQ:", formData);
      setFaqs(faqs.map((f) => (f._id === formData._id ? { ...formData, answeredAt } : f)));
    } else {
      console.log("Add FAQ:", formData);
      setFaqs([...faqs, { ...formData, _id: `faq_${faqs.length + 1}`.padStart(3, "0"), answeredAt }]);
      setPendingQuestions(pendingQuestions.filter((q) => q.question !== formData.question));
    }
    setFormData({ _id: null, question: "", answer: "", askedBy: "", answeredAt: "" });
  };

  const handleEdit = (faq) => {
    setFormData(faq);
  };

  const handleDelete = (id) => {
    console.log("Delete FAQ:", id);
    setFaqs(faqs.filter((f) => f._id !== id));
  };

  const handleDeletePending = (id) => {
    console.log("Delete pending question:", id);
    setPendingQuestions(pendingQuestions.filter((q) => q._id !== id));
  };

  return (
    <div className="w-full bg-white">
      <Title
        title="Manage FAQs"
        subTitle="Answer member questions and manage FAQs."
      />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white border border-gray-300 rounded-md p-6 shadow-sm"
        >
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">
            {formData._id ? "Edit FAQ" : "Answer Question"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Question</label>
              <input
                type="text"
                name="question"
                value={formData.question}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                readOnly={!!formData._id || !!formData.askedBy}
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Asked By</label>
              <input
                type="text"
                name="askedBy"
                value={formData.askedBy}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                readOnly={!!formData.askedBy}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-600 mb-1 font-outfit">Answer</label>
              <textarea
                name="answer"
                value={formData.answer}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md"
                rows="4"
                required
              />
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-[var(--color-primary)] text-white rounded-md py-2 px-4 font-outfit hover:bg-blue-700"
              >
                {formData._id ? "Update" : "Answer"}
              </button>
              {(formData._id || formData.askedBy) && (
                <button
                  type="button"
                  onClick={() => setFormData({ _id: null, question: "", answer: "", askedBy: "", answeredAt: "" })}
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
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Pending Questions</h3>
          <div className="space-y-4 mb-6">
            {pendingQuestions.length === 0 && <p className="text-gray-600 font-outfit">No pending questions.</p>}
            {pendingQuestions.map((question) => (
              <div
                key={question._id}
                className="p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)]"
              >
                <h4 className="font-playfair text-base font-semibold text-gray-800">{question.question}</h4>
                <p className="text-gray-600 font-outfit">Asked by: {question.askedBy} ({question.askedAt})</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleAnswer(question)}
                    className="text-[var(--color-primary)] hover:underline font-outfit"
                  >
                    Answer
                  </button>
                  <button
                    onClick={() => handleDeletePending(question._id)}
                    className="text-red-500 hover:underline font-outfit"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <h3 className="font-playfair text-lg font-semibold text-gray-800 mb-4">Answered FAQs</h3>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <div
                key={faq._id}
                className="p-4 border border-gray-200 rounded-md hover:border-[var(--color-primary)]"
              >
                <h4 className="font-playfair text-base font-semibold text-gray-800">{faq.question}</h4>
                <p className="text-gray-600 font-outfit">Answer: {faq.answer}</p>
                <p className="text-gray-600 font-outfit">Asked by: {faq.askedBy} | Answered: {faq.answeredAt}</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEdit(faq)}
                    className="text-[var(--color-primary)] hover:underline font-outfit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(faq._id)}
                    className="text-red-500 hover:underline font-outfit"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ManageFAQs;