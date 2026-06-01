import GoogleHealthConnectionPage from '../../components/devices/GoogleHealthConnectionPage';

export default function PulseCheckFitbitPage() {
  return (
    <GoogleHealthConnectionPage
      productName="PulseCheck"
      returnTo="/PulseCheck/fitbit"
      loginHref="/PulseCheck/login"
      backHref="/PulseCheck"
      backLabel="Back to PulseCheck"
    />
  );
}
