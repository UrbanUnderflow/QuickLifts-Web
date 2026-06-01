import GoogleHealthConnectionPage from '../components/devices/GoogleHealthConnectionPage';

export default function FitWithPulseFitbitPage() {
  return (
    <GoogleHealthConnectionPage
      productName="Fit With Pulse"
      returnTo="/fitbit"
      loginHref="/PulseCheck/login"
      backHref="/settings"
      backLabel="Back to settings"
    />
  );
}
