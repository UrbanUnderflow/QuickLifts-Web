import React from 'react';
import type { NextPage } from 'next';
import PageHead from '../components/PageHead';
import CourseExperience from '../components/education/CourseExperience';
import { coachCourses } from '../content/education/coach-courses';

const CoachTrainingPage: NextPage = () => (
  <>
    <PageHead
      metaData={{
        pageId: 'coach-training',
        pageTitle: 'Coach Training | Pulse Intelligence Labs',
        metaDescription:
          'Education for coaches: coach the mental game on purpose — pressure, recovery, mental skills, reading the warning signs, and acting on safety.',
        ogTitle: 'Coach Training — Pulse Intelligence Labs',
        ogDescription: 'Courses that help coaches build a high-standard environment that protects trust and performance.',
        ogImage: 'https://pulseintelligencelabs.com/pil-og.png',
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: 'Coach Training — Pulse Intelligence Labs',
        twitterDescription: 'Coach the mental game with the same intent as the physical one.',
        lastUpdated: new Date().toISOString(),
      }}
      pageOgUrl="https://pulseintelligencelabs.com/coach-training"
      pageOgImage="/pil-og.png"
      themeColor="#FAFAF7"
    />
    <CourseExperience
      courses={coachCourses}
      accent="#456978"
      accent2="#4F6F59"
      eyebrow="Coach training"
      headline="Coach the mental game with the same intent as the physical one."
      subhead="Two ways in: a live certification on coaching the nervous system, and a self-paced playbook for the everyday moments. Start wherever your program needs it most."
      crossHref="/elite-athlete-support-readiness-assessments"
      crossLabel="Readiness assessments"
    />
  </>
);

export default CoachTrainingPage;
