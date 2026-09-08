// client/src/pages/AboutSociety.jsx
//
// CHANGE: replaced placeholder Story/Mission/Vision blurbs with the
// Society's real founding history, provided by the client. Restructured
// from three short boxes into a full narrative article — the real
// content has natural section breaks (Foundation Years, Growth,
// Safeguarding the Vision, Leadership, etc.) that a short-blurb layout
// couldn't accommodate. Each section reuses the same heading style
// already established elsewhere on this page (icon + bold heading),
// and the closing passage is styled as a pull-quote, matching the
// emerald-accent callout pattern already used across the site.

import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ChevronRight, Building2, Landmark, TrendingUp,
  ShieldCheck, Users, HeartHandshake, Compass,
} from "lucide-react";
import usePageTitle from "../hooks/usePageTitle";

const SECTIONS = [
  {
    icon: Landmark,
    heading: "The Beginning",
    paragraphs: [
      "The journey of the Government Officers Housing Scheme (GOHS) began in late 2004 with a shared vision of creating a peaceful, secure, and well-planned residential community beside the Dhalla River, away from the congestion and hustle and bustle of urban life.",
      "The initiative was taken by 21 faculty members of the Bangladesh Public Administration Training Centre (BPATC), Savar, under the leadership of Mr. Mohammad Shafiul Alam, then Joint Secretary to the Government and Member-Directing Staff (MDS) of BPATC. Recognizing the need for an institutional framework to realize their vision, the pioneers established the Government Officers Multipurpose Cooperative Society Limited (GOMCS), which was formally registered in 2005.",
      "In the same year, the Society acquired its first parcel of land, marking the beginning of what would eventually develop into the GOHS project. The initial membership of 21 founding members, along with some of their relatives, stood at 26.",
    ],
  },
  {
    icon: Building2,
    heading: "The Foundation Years",
    paragraphs: [
      "The early development of the Society involved significant challenges, particularly in land acquisition, registration, and institutional coordination. Dr. Mallik Anwar Hossain, then Deputy Director of BPATC and Senior Assistant Secretary, played an important role in facilitating these early processes.",
      "At the time of registration, Mr. Mohammad Shafiul Alam became the first President of GOMCS, while Mr. A.K.M. Enamul Haque, then Deputy Director of BPATC, served as Secretary. They continued in these positions for three consecutive terms until 2014 and played a pivotal role in establishing the institutional foundations of the Society.",
      "An interesting aspect of the early history is that, even before the Society acquired land, one of the BPATC faculty members had personally purchased land in the area. This individual initiative subsequently became part of the broader inspiration for the collective housing initiative that evolved into GOHS.",
    ],
  },
  {
    icon: TrendingUp,
    heading: "From a Small Initiative to a Growing Community",
    paragraphs: [
      "Through sustained efforts over the years, the Society acquired approximately 42 acres of land through 103 registered deeds. The membership also expanded substantially, from the original group of pioneers to 426 members.",
      "Because the initiative originated largely from officers of BPATC, the project became locally known as the \u201cBPATC Project,\u201d a name that continues to be used in the locality.",
      "The acquisition of land was accompanied by efforts to improve access and connectivity. The contributions of Mr. Syed Mahabubur Rahman, then Additional Secretary of the Ministry of Communications and a member of the Society, and Mr. Wahidur Rahman, then Chief Engineer of the Local Government Engineering Department (LGED), deserve particular recognition. Their efforts contributed to the development and widening of the main access road to the project.",
      "They also played important roles in facilitating the construction of a bridge over the adjacent Dhaleshwari River, south of Nama Bazar in Savar. Improved road and river connectivity significantly enhanced the accessibility and development potential of the GOHS area.",
    ],
  },
  {
    icon: ShieldCheck,
    heading: "Safeguarding the GOHS Vision",
    paragraphs: [
      "The journey was not without significant challenges. At one stage, the Government proposed acquiring the GOHS land for establishing a pharmaceutical industrial facility. This posed a serious threat to the residential aspirations of the members.",
      "A delegation of the Society, led by Mr. Abu Mohammad Moniruzzaman, then Secretary of the Ministry of Defence and a member of the Society, met with the Chairman of the Investment Board to present the concerns of the members and seek protection of the project.",
      "The initiative was successful, and the proposed pharmaceutical industrial estate was subsequently relocated from Fordnagar to Baushi in Munshiganj. This decision safeguarded the future of the GOHS project and enabled the members to continue pursuing their original vision.",
    ],
  },
  {
    icon: Users,
    heading: "Continuity of Leadership",
    paragraphs: [
      "The development of GOHS has been supported by the commitment of successive leaders and management committees. Following the formative years of the founding leadership, Mr. Abul Kalam Azad, former Principal Secretary to the Government, and Mr. Ataur Rahman, former Additional Secretary to the Government, served as Presidents of GOMCS at different periods.",
      "Their leadership, together with the contributions of successive management committees and members, helped sustain the progress of the Society and strengthen its institutional foundation.",
      "Today, GOHS has taken a more defined and promising shape under the leadership of Dr. Md. Mahamud Ul Hoque and the present Management Committee. Their efforts have focused on strengthening coordination, institutional discipline, transparency, professionalism, and forward-looking development, building upon the foundations established by the pioneers and successive leaders.",
    ],
  },
  {
    icon: Compass,
    heading: "More Than a Housing Project",
    paragraphs: [
      "GOHS represents more than the development of land and residential plots. It embodies a collective aspiration to establish a peaceful, secure, dignified, modern, environmentally responsible, and sustainable residential community.",
      "The vision is to create a planned neighbourhood where families can live safely and comfortably, children can grow in a healthy environment, neighbours can enjoy a strong sense of community, and nature and modern living can coexist harmoniously.",
      "The natural setting beside the river provides GOHS with a unique advantage. Preserving this environment while ensuring planned and sustainable development remains an important part of the long-term vision.",
    ],
  },
  {
    icon: HeartHandshake,
    heading: "A Legacy of Collective Effort",
    paragraphs: [
      "The history of GOHS is a testament to the power of vision, leadership, unity, perseverance, and collective responsibility.",
      "What began in 2004 with 21 BPATC faculty members has evolved into a substantial collective initiative involving hundreds of members. The achievements of GOHS are the result of the contributions of its pioneers, successive leaders, management committees, and members who have supported the project throughout its journey.",
      "Every parcel of land acquired, every deed registered, every improvement in connectivity, and every step toward institutional development represents a chapter in this collective endeavour.",
    ],
  },
];

const AboutSociety = () => {
  usePageTitle("About Society");

  return (
    <div className="w-full bg-white min-h-screen">

      {/* Hero */}
      <div className="relative w-full overflow-hidden">
        <div className="absolute inset-0 bg-[url('/src/assets/heroImage6.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/55 to-black/75" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center text-center">
          <nav aria-label="Breadcrumb" className="mb-5">
            <ol className="flex items-center justify-center gap-1.5 text-base">
              <li>
                <Link to="/" className="text-white/70 hover:text-white font-outfit font-medium transition-colors">
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} />
                <span className="text-emerald-400 font-outfit font-medium">About Society</span>
              </li>
            </ol>
          </nav>

          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white/15 text-white border border-white/25 mb-5">
            Est. 2005
          </span>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold text-white leading-tight"
          >
            The Journey of GOHS: <span className="text-emerald-400">From Vision to Reality</span>
          </motion.h1>

          <p className="mt-3 text-white/70 font-outfit text-sm italic">
            A Story of Vision, Leadership, Unity and Perseverance
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 mt-10 md:mt-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="h-1" style={{ backgroundColor: "#84A98C" }} />

          <div className="p-6 md:p-10 space-y-10">
            {SECTIONS.map(({ icon: Icon, heading, paragraphs }) => (
              <section key={heading}>
                <h2 className="font-bold text-xl text-gray-900 mb-3 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  {heading}
                </h2>
                <div className="space-y-3">
                  {paragraphs.map((p, i) => (
                    <p key={i} className="text-gray-700 font-outfit leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}

            {/* Looking Ahead — pull-quote style, matching the emerald
                accent callout pattern used elsewhere on the site */}
            <section>
              <h2 className="font-bold text-xl text-gray-900 mb-3 flex items-center gap-2">
                <Compass className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                Looking Ahead
              </h2>
              <div className="space-y-3 mb-5">
                <p className="text-gray-700 font-outfit leading-relaxed">
                  As GOHS moves forward, its original vision remains unchanged: to develop a well-planned, peaceful, secure, environmentally friendly, modern, inclusive, and sustainable residential community that members can proudly call home.
                </p>
                <p className="text-gray-700 font-outfit leading-relaxed">
                  The next phase of development will require continued unity, transparency, accountability, professionalism, mutual respect, and commitment to the common good. The responsibility of the present generation is to consolidate the achievements of the past and create a stronger foundation for future generations.
                </p>
              </div>

              <div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-r-xl px-5 py-4">
                <p className="text-emerald-900 font-outfit leading-relaxed italic">
                  May GOHS become a community where peace meets progress, nature meets modernity, and individual aspirations unite for the common good.
                </p>
                <p className="text-emerald-700 font-outfit text-sm mt-3">
                  The journey continues \u2014 with gratitude to the pioneers, respect for those who contributed along the way, and renewed commitment to building a better future for all members of GOHS.
                </p>
              </div>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutSociety;