import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import WorkoutService from '../services/WorkoutService';
import CollectionSweatlistItem from '../components/CollectionSweatlistItem';
import { Workout } from '../api/firebase/workout'; 

const CollectionPreviewer: React.FC = () => {
  const router = useRouter();
  const [collection, setCollection] = useState<any | null>(null); // Assuming `collection` doesn't have a specific type yet
  const [sweatLists, setSweatLists] = useState<Workout[]>([]); // Ensure correct typing for sweat lists (workouts)
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const collectionId = (router.query.collectionId as string) || '57D465B8-A48B-46BF-A76A-3B4EC8D52470';

  useEffect(() => {
    const fetchCollection = async () => {
      try {
        setIsLoading(true);
        const fetchedCollection = await WorkoutService.sharedInstance.fetchCollectionWithSweatLists(collectionId);
        console.log(`There are ${fetchedCollection.sweatLists.length} sweatlists in this collection`);
        if (fetchedCollection) {
          setCollection(fetchedCollection.collection);
          setSweatLists(fetchedCollection.sweatLists || []);
        } else {
          setError('No collection data returned');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCollection();
  }, [collectionId]);

  if (isLoading) {
    return <div className="text-white text-center pt-20">Loading collection...</div>;
  }

  if (error || !collection) {
    return <div className="text-white text-center pt-20">Error loading collection: {error || 'Unknown error'}</div>;
  }

  return (
    <div className="relative h-screen bg-black">
      {/* Download banner */}
      <div className="fixed top-0 left-0 right-0 bg-[#E0FE10] text-black py-2 px-4 text-center z-50">
        <p className="font-bold">
          Download the Pulse app for full access to this collection
          <button 
            onClick={() => window.open("https://apps.apple.com/us/app/pulse-the-fitness-collective/id6451497729", "_blank")} 
            className="underline ml-2 font-bold bg-transparent border-none cursor-pointer"
          >
            Get App
          </button>
        </p>
      </div>

      <div className="absolute inset-0 mt-80 overflow-y-auto bg-gradient-to-b from-transparent via-[#192126] via-25% to-[#192126] to-50%">
        <div className="flex flex-col min-h-full p-4 pb-20 pt-12">
          <div className="flex-grow">
            <div className="text-center text-white mt-10 mb-1">
              <h2 className="text-2xl font-bold">Your collection for today:</h2>
              <p className="text-xl font-bold text-[#E0FE10]">{collection.title}</p>
              <p className="text-m text-white mt-2">{collection.subtitle || ''}</p>
            </div>

            {/* Collection stats */}
            <div className="flex justify-around my-10">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#E0FE10]">{sweatLists.length}</p>
                <p className="text-m text-white">Sweat Lists</p>
              </div>
            </div>

            {/* Sweat Lists */}
            <div className="mt-6 mb-28">
              {sweatLists.map((workout) => (
                <CollectionSweatlistItem
                  key={workout.id}
                  workout={workout} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky floating button */}
      <div className="fixed bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black to-transparent">
        <button
          onClick={() => window.open("https://apps.apple.com/us/app/pulse-the-fitness-collective/id6451497729", "_blank")}
          className="w-full py-3 bg-[#E0FE10] text-black font-bold rounded-full text-lg"
        >
          Track this Collection
        </button>
      </div>
    </div>
  );
};


export default CollectionPreviewer;