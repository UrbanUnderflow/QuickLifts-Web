import { createPublicProfileHandler } from './public';
import { loadPublicOfferings } from '../../../lib/profiles/publicOfferings';
export default createPublicProfileHandler(loadPublicOfferings as any);
