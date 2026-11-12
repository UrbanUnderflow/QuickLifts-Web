import { authorizeDashboardRequest } from '../../../../lib/coach-dashboard/auth';
import { scope } from '../../../../lib/coach-communications/service';
import { runtimeDiagnostic } from '../../../../lib/coach-communications/runtime-diagnostic';
export const config = { api: { bodyParser: { sizeLimit: '1kb' } } };
export default runtimeDiagnostic({authorize: authorizeDashboardRequest, scope, key: () => process.env.TELNYX_API_KEY, fetch: (...args) => fetch(...args), now: Date.now});
