import React from 'react'
import Hero from '../components/Hero'
import NoticesPreview from '../components/NoticesPreview'
import CommunityGallery from '../components/CommounityGallery'
import FAQ from '../components/FAQ'
import usePageTitle from "../hooks/usePageTitle";

const Home = () => {
  usePageTitle(null);
  
  return (
    <>
      <Hero />
      <NoticesPreview />
      <CommunityGallery />
      <FAQ />
    </>
  )
}

export default Home
