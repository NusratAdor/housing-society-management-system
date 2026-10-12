import React from "react";
import { Droplets, Zap } from "lucide-react";
import usePageTitle from "../../hooks/usePageTitle";
import { UTILITY_SERVICES } from "../../utils/serviceInfo";
import { ServiceHero, ServiceCard } from "../../components/services/ServiceParts";

const ICONS = { water: Droplets, electrical: Zap };

const UtilityServices = () => {
  usePageTitle("Utility Services");

  return (
    <div className="w-full bg-white min-h-screen">
      <ServiceHero
        crumbs={[{ label: "Home", to: "/" }, { label: "Services", to: "/our-services" }, { label: "Utility Services" }]}
        title="Utility"
        highlight="Services"
        subtitle="Request assistance for water and electrical services within the society."
      />

      <div className="max-w-4xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {Object.entries(UTILITY_SERVICES).map(([type, service], i) => (
            <ServiceCard
              key={type}
              index={i}
              to={`/our-services/utility-services/${type}`}
              icon={ICONS[type]}
              title={`${service.title} Service`}
              description={service.description}
              action={service.action}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default UtilityServices;