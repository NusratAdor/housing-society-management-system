import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { faqsDummyData } from "../assets/assets";
import Title from "./Title";
import { ChevronDown, ChevronUp } from "lucide-react";

const FAQSection = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="w-full bg-white py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center text-center">
        <Title
          title="Frequently Asked Questions"
          subTitle="Explore questions asked by our community members and answers provided by our admins."
        />
        <div className="mt-12 w-full max-w-3xl">
          {faqsDummyData.slice(0, 5).map((faq, index) => (
            <div
              key={faq._id}
              className="border-b border-gray-200 py-4 cursor-pointer w-full"
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-playfair text-lg font-medium text-left">{faq.question}</h3>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-[var(--color-primary)]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[var(--color-primary)]" />
                )}
              </div>
              <div
                className={`text-sm text-gray-600 mt-2 text-left transition-all duration-500 ease-in-out ${
                  openIndex === index
                    ? "opacity-100 max-h-[300px] translate-y-0"
                    : "opacity-0 max-h-0 -translate-y-2 overflow-hidden"
                }`}
              >
                <p>{faq.answer}</p>
                <div className="mt-2 text-sm text-gray-500">
                  <span>Asked by {faq.askedBy}</span> • <span>Answered on {faq.answeredAt}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            navigate("/faqs");
            window.scrollTo(0, 0);
          }}
          className="mt-12 px-4 py-2 text-sm font-medium border border-gray-300 rounded-full bg-white hover:bg-gray-50 transition-all cursor-pointer"
        >
          View All FAQs
        </button>
      </div>
    </div>
  );
};

export default FAQSection;