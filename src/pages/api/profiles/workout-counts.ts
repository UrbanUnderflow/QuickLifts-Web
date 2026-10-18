import { createPublicProfileHandler } from './public';
import { loadPublicWorkoutCount } from '../../../lib/profiles/publicWorkoutCounts';
export default createPublicProfileHandler(loadPublicWorkoutCount as any);
