import React from 'react';
import type { NextPage } from 'next';
import PageHead from '../components/PageHead';
import CourseExperience from '../components/education/CourseExperience';
import { athleticTrainerCourses } from '../content/education/athletic-trainer-courses';

const AthleticTrainerTrainingPage: NextPage = () => (
  <>
    <PageHead
      metaData={{
        pageId: 'athletic-trainer-training',
        pageTitle: 'Athletic Trainer Training | Pulse Intelligence Labs',
        metaDescription:
          'Education for athletic trainers: extend your clinical expertise into performance neuroscience, return-to-play confidence, and performance-vs-clinical triage.',
        ogTitle: 'Athletic Trainer Training — Pulse Intelligence Labs',
        ogDescription: 'Performance neuroscience and mental-readiness training for sports medicine staff.',
        ogImage: 'https://pulseintelligencelabs.com/pil-og.png',
        ogType: 'website',
        twitterCard: 'summary_large_image',
        twitterTitle: 'Athletic Trainer Training — Pulse Intelligence Labs',
        twitterDescription: 'Bridge sports medicine into performance neuroscience and mental readiness.',
        lastUpdated: new Date().toISOString(),
      }}
      pageOgUrl="https://pulseintelligencelabs.com/athletic-trainer-training"
      pageOgImage="/pil-og.png"
      themeColor="#FAFAF7"
    />
    <CourseExperience
      courses={athleticTrainerCourses}
      accent="#6F6888"
      accent2="#58735E"
      eyebrow="Athletic trainer training"
      headline="Extend your clinical expertise into performance neuroscience."
      subhead="Two ways in: a live certification bridging sports medicine into mental readiness, and a self-paced playbook for partnering with athletes already in a mental-performance program."
      crossHref="/elite-athlete-support-readiness-assessments"
      crossLabel="Readiness assessments"
    />
  </>
);

export default AthleticTrainerTrainingPage;
