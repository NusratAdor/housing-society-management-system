import React from "react";
import { BedDouble, Wrench } from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";
import { GUEST_HOUSE_RATE } from "../utils/serviceInfo";
import { ServiceHero, ServiceCard } from "../components/services/ServiceParts";

const Services = () => {
  usePageTitle("Our Services");

  return (
    <div className="w-full bg-white min-h-screen">
      <ServiceHero
        crumbs={[{ label: "Home", to: "/" }, { label: "Services" }]}
        title="Our"
        highlight="Services"
        subtitle="Convenient services designed for our members and their everyday needs."
      />

      <div className="max-w-4xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <ServiceCard
            index={0}
            to="/our-services/guest-house"
            icon={BedDouble}
            title="Guest House"
            description="A convenient accommodation facility for members and their guests."
            detail="Available for members upon booking request."
            action="View Guest House"
          />
          <ServiceCard
            index={1}
            to="/our-services/utility-services"
            icon={Wrench}
            title="Utility Services"
            description="Request assistance for water and electrical services within the society."
            action="View Utility Services"
          />
        </div>
      </div>
    </div>
  );
};

export default Services;
