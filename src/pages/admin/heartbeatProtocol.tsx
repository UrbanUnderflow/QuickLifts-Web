// This page has been moved to a tab within /admin/systemOverview.
// Redirecting for any bookmarked URLs.
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function HeartbeatProtocolRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/admin/systemOverview?tab=heartbeat');
    }, [router]);
    return null;
}
