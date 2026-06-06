import React from 'react';
import type { NextPage } from 'next';
import PageHead from '../components/PageHead';
import CourseExperience from '../components/education/CourseExperience';
import { parentCourses } from '../content/education/parent-courses';

const ParentTrainingPage: NextPage = () => (
  <>
    <PageHead
      metaData={{
        pageId: 'parent-training',
        pageTitle: 'Parent Training | Pulse Intelligence Labs',
        metaDescription:
          'Education for sports parents: support your child through pressure, recognize the warning signs early, and know exactly what to do at every step.',
        ogTitle: 'Parent Training — Pulse Intelligence Labs',
        ogDescription: 'Courses that help parents support the emotional and mental needs of a young athlete.',
        ogImage: 'https://pulseintelligencelabs.com/pil-og.png',
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: 'Parent Training — Pulse Intelligence Labs',
        twitterDescription: 'Support your child through the pressures of competing.',
        lastUpdated: new Date().toISOString(),
      }}
      pageOgUrl="https://pulseintelligencelabs.com/parent-training"
      pageOgImage="/pil-og.png"
      themeColor="#FAFAF7"
    />
    <CourseExperience
      courses={parentCourses}
      accent="#4F6F59"
      accent2="#456978"
      eyebrow="Parent training"
      headline="Learn to support your child through the pressures of sport."
      subhead="Two ways in: a live foundation on the athlete brain under pressure, and a self-paced course on spotting the warning signs early. Start wherever you need it most."
      crossHref="/elite-athlete-support-readiness-assessments"
      crossLabel="Readiness assessments"
    />
  </>
);

export default ParentTrainingPage;
