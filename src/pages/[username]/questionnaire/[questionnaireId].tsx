import React, { useState } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { creatorPagesService, Survey, CLIENT_QUESTIONNAIRES_PAGE_SLUG, SurveyQuestion } from '../../../api/firebase/creatorPages/service';
import { SurveyTakingModal } from '../../../components/Surveys';

// Generate dynamic OG image URL based on page title
const generateDynamicOgImage = (title: string, subtitle?: string): string => {
  const baseUrl = 'https://fitwithpulse.ai/og-image.png';
  const params = new URLSearchParams({ title });
  // NOTE: intentionally not sending subtitle. Social previews should be title-only.
  return `${baseUrl}?${params.toString()}`;
};

interface SerializedSurvey {
  id: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
  userId: string;
  pageSlug: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientQuestionnairePageProps {
  questionnaire: SerializedSurvey | null;
  ownerUserId: string | null;
  username: string;
  questionnaireId: string;
  error: string | null;
}

const ClientQuestionnairePage: React.FC<ClientQuestionnairePageProps> = ({
  questionnaire,
  ownerUserId,
  username,
  questionnaireId,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const pageTitle = questionnaire?.title || 'Client Questionnaire';
  const pageDescription = questionnaire?.description || 'Fill out this questionnaire';
  const pageUrl = `https://fitwithpulse.ai/${username}/questionnaire/${questionnaireId}`;
  const ogImage = generateDynamicOgImage(pageTitle, pageDescription);

  // Convert serialized survey back to Survey type for the modal
  const surveyForModal: Survey | null = questionnaire
    ? {
        ...questionnaire,
        createdAt: new Date(questionnaire.createdAt),
        updatedAt: new Date(questionnaire.updatedAt),
      }
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />

        {/* OpenGraph Meta Tags */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:secure_url" content={ogImage} />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={pageTitle} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Pulse Fitness" />

        {/* Twitter Card Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImage} />
        <meta name="twitter:image:alt" content={pageTitle} />

        <link rel="canonical" href={pageUrl} />
        <meta name="theme-color" content="#E0FE10" />
      </Head>

      {error || !surveyForModal || !ownerUserId ? (
        <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
          <div>
            <h1 className="text-2xl font-bold mb-2">Unable to load questionnaire</h1>
            <p className="text-zinc-400">{error || 'Not found'}</p>
          </div>
        </div>
      ) : !isOpen ? (
        <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold mb-2">Thanks!</h1>
            <p className="text-zinc-400">You can close this window now.</p>
          </div>
        </div>
      ) : (
        <SurveyTakingModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          survey={surveyForModal}
          onSubmit={async (answers, respondentName, respondentEmail) => {
            const responseId = await creatorPagesService.submitSurveyResponse(
              ownerUserId,
              CLIENT_QUESTIONNAIRES_PAGE_SLUG,
              surveyForModal.id,
              {
                answers,
                respondentName,
                respondentEmail,
              }
            );

            // Fire-and-forget: notify the host via Brevo that the intake was completed.
            // This runs server-side (keeps Brevo keys off the client) and is idempotent.
            try {
              await fetch('/api/surveys/notify-completed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ownerUserId,
                  pageSlug: CLIENT_QUESTIONNAIRES_PAGE_SLUG,
                  surveyId: surveyForModal.id,
                  responseId,
                  username,
                }),
              });
            } catch (e) {
              console.warn('Failed to send intake completion notification:', e);
            }
          }}
        />
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<ClientQuestionnairePageProps> = async (context) => {
  const { username, questionnaireId } = context.params as { username: string; questionnaireId: string };

  try {
    // Find the user ID by username
    const userId = await creatorPagesService.findUserIdByUsername(username);
    if (!userId) {
      return {
        props: {
          questionnaire: null,
          ownerUserId: null,
          username,
          questionnaireId,
          error: 'Coach not found',
        },
      };
    }

    // Fetch the questionnaire
    const survey = await creatorPagesService.getSurveyById(userId, CLIENT_QUESTIONNAIRES_PAGE_SLUG, questionnaireId);
    if (!survey) {
      return {
        props: {
          questionnaire: null,
          ownerUserId: null,
          username,
          questionnaireId,
          error: 'Questionnaire not found',
        },
      };
    }

    // Serialize dates for JSON transfer
    const serializedSurvey: SerializedSurvey = {
      id: survey.id,
      title: survey.title,
      description: survey.description,
      questions: survey.questions,
      userId: survey.userId,
      pageSlug: survey.pageSlug,
      createdAt: survey.createdAt?.toISOString?.() || new Date().toISOString(),
      updatedAt: survey.updatedAt?.toISOString?.() || new Date().toISOString(),
    };

    return {
      props: {
        questionnaire: serializedSurvey,
        ownerUserId: userId,
        username,
        questionnaireId,
        error: null,
      },
    };
  } catch (e: any) {
    console.error('Error fetching questionnaire:', e);
    return {
      props: {
        questionnaire: null,
        ownerUserId: null,
        username,
        questionnaireId,
        error: e?.message || 'Failed to load questionnaire',
      },
    };
  }
};

export default ClientQuestionnairePage;
