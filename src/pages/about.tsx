import React, { useMemo, useState } from 'react';
import type { NextPage, GetStaticProps } from 'next';
import HomePage, { getStaticProps as getHomeStaticProps } from './index';

// Reuse the Home page so /about renders exactly the same content
// This keeps a single source of truth for the marketing layout

type HomeProps = React.ComponentProps<typeof HomePage>;

const About: NextPage<HomeProps> = (props) => {
  // Lightweight, client-side demo for the data story card
  const [caloriesIn, _setCaloriesIn] = useState<number>(2200);
  const [caloriesOut, _setCaloriesOut] = useState<number>(2600);
  const _status = useMemo(() => {
    const diff = caloriesIn - caloriesOut;
    return {
      diff,
      label: diff > 0 ? 'Caloric Surplus' : diff < 0 ? 'Caloric Deficit' : 'Neutral',
      color: diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-zinc-300',
      barColor: diff > 0 ? 'bg-green-500/70' : diff < 0 ? 'bg-red-500/70' : 'bg-zinc-500/70'
    };
  }, [caloriesIn, caloriesOut]);

  return (
    <>
      <HomePage {...props} />

    </>
  );
};

export const getStaticProps: GetStaticProps = getHomeStaticProps;

export default About;