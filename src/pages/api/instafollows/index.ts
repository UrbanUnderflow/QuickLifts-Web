import {reviewHandler} from '../../../lib/instafollows/server';
export const config={api:{bodyParser:{sizeLimit:'2kb'},responseLimit:'2mb'}};
export default reviewHandler();
