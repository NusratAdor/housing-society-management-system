import React from "react";
import usePageTitle from "../hooks/usePageTitle";
import { useTranslation } from "react-i18next";

const Contact = () => {

  const { t } = useTranslation("navbar");
  usePageTitle(t("contact"));


  return (

    <div className="w-full bg-white">
      {/* Google Map */}
      <div className="w-full h-[350px]">
        <iframe
          className="w-full h-full"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14599.079516776896!2d90.2303675626977!3d23.826780736850576!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755eb6c78b0bda7%3A0x6134ba1b3c074efa!2sGOHS%20-%20Fordnagar%20Singair%20Manikganj!5e0!3m2!1sen!2sbd!4v1757558746658!5m2!1sen!2sbd" 
          style={{ border: 0 }}
          allowFullScreen=""
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Kazi Tower Location"
        ></iframe>
      </div>

      {/* Contact Section */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <h2 className="text-3xl font-semibold mb-8 text-gray-800 text-center">Get in Touch</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="space-y-6 text-gray-700 text-sm">
            <div>
              <h3 className="font-semibold text-base mb-1 text-gray-900">Address</h3>
              <p>Fordnagar, Singair, Manikgonj</p>
            </div>
            <div>
              <h3 className="font-semibold text-base mb-1 text-gray-900">Phone</h3>
              <p>+8801737051767</p>
            </div>
            <div>
              <h3 className="font-semibold text-base mb-1 text-gray-900">Email</h3>
              <p>gomcsadmn975@gmail.com</p>
            </div>
            <div>
              <h3 className="font-semibold text-base mb-1 text-gray-900">Office Hours</h3>
              <p>Sunday - Thursday: 9:00 AM - 6:00 PM</p>
              <p>Friday & Saturday: Closed</p>
            </div>
          </div>

          {/* Contact Form */}
          <form className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Your Name"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                placeholder="Your Email"
                className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <input
              type="text"
              placeholder="Subject"
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Your Message"
              rows={5}
              className="w-full border border-gray-300 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            ></textarea>
            <button
              type="submit"
              className="px-6 py-2 rounded-full bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-blue-700 transition-all"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Contact;
