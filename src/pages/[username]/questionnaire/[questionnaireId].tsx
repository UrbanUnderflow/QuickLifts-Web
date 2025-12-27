import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { creatorPagesService, Survey, CLIENT_QUESTIONNAIRES_PAGE_SLUG } from '../../../api/firebase/creatorPages/service';
import { SurveyTakingModal } from '../../../components/Surveys';

const ClientQuestionnairePage: React.FC = () => {
  const router = useRouter();
  const { username, questionnaireId } = router.query as { username?: string; questionnaireId?: string };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Survey | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  const baseUrl = useMemo(() => {
    return process.env.NODE_ENV === 'development' ? 'http://localhost:8888' : 'https://fitwithpulse.ai';
  }, []);

  useEffect(() => {
    if (!router.isReady || !username || !questionnaireId) return;
    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const userId = await creatorPagesService.findUserIdByUsername(username);
        if (!userId) {
          throw new Error('Coach not found');
        }
        if (!active) return;
        setOwnerUserId(userId);

        const survey = await creatorPagesService.getSurveyById(userId, CLIENT_QUESTIONNAIRES_PAGE_SLUG, questionnaireId);
        if (!survey) {
          throw new Error('Questionnaire not found');
        }
        if (!active) return;
        setQuestionnaire(survey);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message || 'Failed to load questionnaire');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [router.isReady, username, questionnaireId]);

  const pageTitle = questionnaire?.title || 'Client Questionnaire';

  return (
    <div className="min-h-screen bg-black text-white">
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={questionnaire?.description || 'Client questionnaire'} />
        <link
          rel="canonical"
          href={`${baseUrl}/${username || ''}/questionnaire/${questionnaireId || ''}`}
        />
      </Head>

      {loading ? (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>
      ) : error || !questionnaire || !ownerUserId ? (
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
          survey={questionnaire}
          onSubmit={async (answers, respondentName, respondentEmail) => {
            await creatorPagesService.submitSurveyResponse(
              ownerUserId,
              CLIENT_QUESTIONNAIRES_PAGE_SLUG,
              questionnaire.id,
              {
                answers,
                respondentName,
                respondentEmail,
              }
            );
          }}
        />
      )}
    </div>
  );
};

export default ClientQuestionnairePage;


