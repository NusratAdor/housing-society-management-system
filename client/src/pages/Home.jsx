import React from 'react'
import Hero from '../components/Hero'
import NoticesPreview from '../components/NoticesPreview'
import EventsPreview from '../components/EventsPreview'
import CommunityGallery from '../components/CommunityGallery'
import SocietyIntroduction from '../components/SocietyIntroduction'
import VisionMissionPreview from '../components/VisionMissionPreview'
import FAQ from '../components/FAQ'
import usePageTitle from "../hooks/usePageTitle";

const Home = () => {
  usePageTitle(null);

  return (
    <>
      <Hero />
      <SocietyIntroduction />
      <NoticesPreview />
      <EventsPreview />
      <CommunityGallery />
       <FAQ />
      <VisionMissionPreview />
     
    </>
  )
}

export default Home