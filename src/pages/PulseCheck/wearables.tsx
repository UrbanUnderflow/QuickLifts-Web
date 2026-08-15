import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  HeartPulse,
  LockKeyhole,
  Smartphone,
  Watch,
} from 'lucide-react';
import { platformDetection } from '../../utils/platformDetection';
import styles from './wearables.module.css';

type Platform = 'ios' | 'android';
type DeviceId = 'apple-watch' | 'health-connect' | 'polar' | 'fitbit' | 'oura' | 'whoop';

type SetupVariant = {
  summary: string;
  requirements: string[];
  steps: string[];
  verified: string;
  troubleshooting: string[];
};

type DeviceGuide = {
  id: DeviceId;
  name: string;
  shortName: string;
  image?: string;
  accent: string;
  supportedOn: Platform[];
  signal: string;
  action?: { label: string; href: string };
  officialHelp: { label: string; href: string };
  setup: Record<Platform, SetupVariant>;
};

type StepCapture = {
  kind: 'capture';
  src: string;
  alt: string;
  label: string;
  detail: string;
  frame?: 'phone' | 'card';
};

type StepReference = {
  kind: 'reference';
  label: string;
  detail: string;
  href?: string;
  linkLabel?: string;
};

type StepVisual = StepCapture | StepReference;

const IOS_APP_STORE_URL = 'https://apps.apple.com/app/pulsecheck-mindset-coaching/id6747253393';
const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.fitwithpulse.pulsecheck';
const PULSECHECK_APP_URL = 'pulsecheck://open';

const deviceGuides: DeviceGuide[] = [
  {
    id: 'apple-watch',
    name: 'Apple Watch',
    shortName: 'Apple Watch',
    image: '/pulsecheck-youth/wearables/apple-watch.png',
    accent: '#67e8f9',
    supportedOn: ['ios'],
    signal: 'Sleep, heart rate, activity',
    officialHelp: {
      label: 'Apple Health sharing help',
      href: 'https://support.apple.com/guide/iphone/share-health-data-iph5ede58c3d/ios',
    },
    setup: {
      ios: {
        summary: 'Apple Watch data reaches PulseCheck through Apple Health on your iPhone.',
        requirements: ['Apple Watch paired to this iPhone', 'PulseCheck account', 'A recent Health record'],
        steps: [
          'Tap the Health app icon, then confirm that Apple Watch heart rate, sleep, or activity appears in Health.',
          'Open PulseCheck, then go to Profile, Settings, and Your devices.',
          'Choose Apple Watch. On the Connect Apple Watch sheet, tap Connect Apple Watch.',
          'On the iPhone Health access sheet, allow the categories you want PulseCheck to read, including heart rate, sleep, and activity.',
          'Return to the PulseCheck home screen and confirm the device card shows Apple Health connected.',
        ],
        verified: 'The PulseCheck home device card shows Apple Health connected, then Sports Intel can use the latest Apple Health record once the next sync lands.',
        troubleshooting: [
          'In the Health app, tap your profile picture, Apps, then PulseCheck to review each permission.',
          'Confirm the Apple Watch is writing recent data to Health before reconnecting PulseCheck.',
          'Open PulseCheck again after the Health app finishes updating.',
        ],
      },
      android: {
        summary: 'Apple Watch does not connect directly to PulseCheck on Android.',
        requirements: ['An iPhone paired with the Apple Watch'],
        steps: [
          'Open this guide on the iPhone paired with your Apple Watch.',
          'Switch the phone selector to iPhone and complete the Apple Health setup.',
        ],
        verified: 'The Apple Watch connection is completed from PulseCheck on iPhone.',
        troubleshooting: ['For an Android watch or health app, use the Health Connect guide instead.'],
      },
    },
  },
  {
    id: 'health-connect',
    name: 'Android watch + Health Connect',
    shortName: 'Health Connect',
    accent: '#4ade80',
    supportedOn: ['android'],
    signal: 'Android sleep, heart rate, activity',
    officialHelp: {
      label: 'Health Connect permissions help',
      href: 'https://support.google.com/android/answer/12201230',
    },
    setup: {
      ios: {
        summary: 'Health Connect is an Android connection. Apple Watch uses Apple Health on iPhone.',
        requirements: ['An Android phone with Health Connect available'],
        steps: [
          'Open this guide on your Android phone.',
          'Switch the phone selector to Android and follow the Health Connect setup.',
        ],
        verified: 'PulseCheck reads a recent record from an approved Android health source.',
        troubleshooting: ['For Apple Watch, use the Apple Watch guide on iPhone.'],
      },
      android: {
        summary: 'Health Connect brings supported watch and health-app records into PulseCheck on Android.',
        requirements: ['Android phone with Health Connect', 'Watch or health app already syncing', 'PulseCheck account'],
        steps: [
          'Confirm your watch or companion app has completed a recent sync before opening PulseCheck.',
          'Open PulseCheck, go to Profile, then open Your devices.',
          'Choose Health Connect and tap Connect.',
          'If Android shows Get started with Health Connect, tap Get started. Then allow the categories you want to share, including sleep, heart rate, steps, and activity.',
          'Return to PulseCheck and confirm the home device card shows Health Connect reporting.',
        ],
        verified: 'The PulseCheck home device card shows Health Connect reporting once a recent watch or health-app record is available.',
        troubleshooting: [
          'Open Health Connect, then App permissions, and confirm PulseCheck can read the selected categories.',
          'Check that the watch companion app is allowed to write those same categories to Health Connect.',
          'Update Health Connect if PulseCheck shows that an update is required.',
        ],
      },
    },
  },
  {
    id: 'polar',
    name: 'Polar 360',
    shortName: 'Polar 360',
    image: '/pulsecheck-youth/wearables/polar-360.png',
    accent: '#a78bfa',
    supportedOn: ['ios', 'android'],
    signal: 'Live heart rate, recovery context',
    officialHelp: {
      label: 'Polar device support',
      href: 'https://support.polar.com/',
    },
    setup: {
      ios: {
        summary: 'Pair Polar inside PulseCheck for live heart rate, then authorize Polar Flow when offered.',
        requirements: ['Charged Polar sensor', 'Bluetooth on', 'Polar Flow account for recovery data'],
        steps: [
          'Charge your Polar 360 before pairing. If the battery is low, leave it on the magnetic charger for at least 30 minutes.',
          'Strap it on your wrist, snug but comfortable, with the sensor flat against your skin.',
          'Turn on iPhone Bluetooth from Control Center, then return to PulseCheck.',
          'On Pick your Polar, select the nearby sensor that belongs to you.',
          'Keep the sensor close while PulseCheck shows Connecting.',
          'Wait for We\'re reading your heart and confirm that the live BPM changes.',
        ],
        verified: 'PulseCheck shows live heart rate from the paired sensor and a recent Polar record when available.',
        troubleshooting: [
          'Pair from the PulseCheck walkthrough, not from the iPhone Bluetooth settings screen.',
          'Wake the sensor, move it closer, and make sure another app is not using its live Bluetooth connection.',
          'If the old pairing was removed, use Reset and pair again from PulseCheck.',
        ],
      },
      android: {
        summary: 'Pair Polar inside PulseCheck for live heart rate and authorize Polar Flow when offered.',
        requirements: ['Charged Polar sensor', 'Bluetooth and Nearby devices allowed', 'PulseCheck account'],
        steps: [
          'Charge and wake your Polar sensor, then keep it close to your Android phone.',
          'Open PulseCheck, then go to Profile and Devices.',
          'Choose Polar and allow Nearby devices or Bluetooth access when Android asks.',
          'Select your sensor in the PulseCheck pairing screen and complete the connection.',
          'Keep the sensor nearby until PulseCheck shows a live heart-rate reading.',
        ],
        verified: 'PulseCheck shows live heart rate from the paired sensor and a recent Polar record when available.',
        troubleshooting: [
          'Pair from PulseCheck rather than the Android Bluetooth settings screen.',
          'Turn off battery saving while pairing and confirm PulseCheck has Nearby devices permission.',
          'Close any other app actively connected to the sensor, then scan again.',
        ],
      },
    },
  },
  {
    id: 'fitbit',
    name: 'Google Fitbit Air',
    shortName: 'Fitbit Air',
    image: '/pulsecheck-youth/wearables/fitbit.png',
    accent: '#ff7a59',
    supportedOn: ['ios', 'android'],
    signal: 'Sleep, heart rate, activity',
    action: { label: 'Connect Fitbit on web', href: '/PulseCheck/fitbit' },
    officialHelp: {
      label: 'Google Fitbit setup help',
      href: 'https://support.google.com/googlehealth/answer/14236818',
    },
    setup: {
      ios: {
        summary: 'Fitbit Air syncs to its Google account first, then PulseCheck reads the approved Google Health data.',
        requirements: ['Fitbit paired in Google Health', 'Same Google account', 'A recent Fitbit sync'],
        steps: [
          'Open Google Health, confirm Fitbit Air appears under Devices, and let its latest sync finish.',
          'Open PulseCheck, then go to Profile, Settings, and Your devices.',
          'Choose Fitbit Air. On the Connect Fitbit Air sheet, tap Connect Fitbit Air.',
          'Continue with Google and approve the requested health-data access.',
          'Return to the PulseCheck home screen and confirm the device card shows Fitbit Air live.',
        ],
        verified: 'The PulseCheck home device card shows Fitbit Air live once a recent Fitbit or Google Health record is reporting.',
        troubleshooting: [
          'Confirm the Fitbit is paired inside Google Health rather than only in iPhone Bluetooth settings.',
          'Use the same Google account in Google Health and the PulseCheck authorization screen.',
          'Sync the device in Google Health first, then refresh the connection in PulseCheck.',
        ],
      },
      android: {
        summary: 'Fitbit Air syncs to its Google account first, then PulseCheck reads the approved Google Health data.',
        requirements: ['Fitbit paired in Google Health', 'Same Google account', 'A recent Fitbit sync'],
        steps: [
          'Open Google Health, confirm Fitbit Air appears under Devices, and let its latest sync finish.',
          'Open PulseCheck, go to Profile, then open Your devices.',
          'Choose Fitbit Air and tap Set up Fitbit Air.',
          'Continue with Google and approve the requested health-data access.',
          'Return to PulseCheck and confirm the home device card shows Fitbit Air live.',
        ],
        verified: 'The PulseCheck home device card shows Fitbit Air live once a recent Fitbit or Google Health record is reporting.',
        troubleshooting: [
          'Set up Fitbit from Google Health instead of pairing it only in Android Bluetooth settings.',
          'Use the same Google account in Google Health and the PulseCheck authorization screen.',
          'Temporarily turn off battery saving if Google Health is not finishing its sync.',
        ],
      },
    },
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    shortName: 'Oura Ring',
    image: '/pulsecheck-youth/wearables/oura-ring.png',
    accent: '#f4c76b',
    supportedOn: ['ios', 'android'],
    signal: 'Sleep, readiness, recovery',
    action: { label: 'Connect Oura on web', href: '/PulseCheck/oura' },
    officialHelp: {
      label: 'Oura app setup help',
      href: 'https://support.ouraring.com/hc/en-us/articles/42986776499347-Set-Up-the-Oura-App',
    },
    setup: {
      ios: {
        summary: 'Authorize your Oura account once, then PulseCheck can refresh the recovery data you approved.',
        requirements: ['Oura app set up', 'Oura account credentials', 'A recent ring sync'],
        steps: [
          'Slide your Oura on with the smooth side toward your palm and the sensors flush against your skin.',
          'Open the Oura app and wait for the latest sync to finish, then return to PulseCheck.',
          'On Sign in to Oura, tap Open Oura, sign in, and approve readiness, sleep, and HRV access.',
          'Return to PulseCheck and confirm the Oura is connected screen appears before opening Sports Intel.',
        ],
        verified: 'Oura is authorized and PulseCheck shows a recent Oura sleep, readiness, or recovery record.',
        troubleshooting: [
          'Finish the ring sync in the Oura app before refreshing PulseCheck.',
          'If authorization returns without data, reconnect Oura and approve the requested access again.',
          'Use the Oura account that owns the ring currently shown in the Oura app.',
        ],
      },
      android: {
        summary: 'Authorize your Oura account once, then PulseCheck can refresh the recovery data you approved.',
        requirements: ['Oura app set up', 'Oura account credentials', 'A recent ring sync'],
        steps: [
          'Open the Oura app and wait for your ring to finish its latest sync.',
          'In PulseCheck, open Profile and Devices, then choose Oura Ring.',
          'Tap Connect, sign in to Oura, and approve the requested access.',
          'Return to PulseCheck when the authorization page finishes.',
          'Open Sports Intel and confirm a recent sleep or recovery record appears.',
        ],
        verified: 'Oura is authorized and PulseCheck shows a recent Oura sleep, readiness, or recovery record.',
        troubleshooting: [
          'Finish the ring sync in the Oura app before refreshing PulseCheck.',
          'If authorization returns without data, reconnect Oura and approve the requested access again.',
          'Use the Oura account that owns the ring currently shown in the Oura app.',
        ],
      },
    },
  },
  {
    id: 'whoop',
    name: 'WHOOP',
    shortName: 'WHOOP',
    image: '/pulsecheck-youth/wearables/whoop.png',
    accent: '#d4ea04',
    supportedOn: ['ios', 'android'],
    signal: 'Recovery, strain, sleep, HRV',
    officialHelp: {
      label: 'WHOOP device settings help',
      href: 'https://support.whoop.com/s/article/Navigating-the-WHOOP-Mobile-App?language=en_US',
    },
    setup: {
      ios: {
        summary: 'Connect your WHOOP account for recovery data, then pair its broadcast for live heart rate.',
        requirements: ['WHOOP app and account', 'WHOOP charged and connected', 'Bluetooth on for live BPM'],
        steps: [
          'Open the WHOOP app and confirm your strap has finished syncing.',
          'In PulseCheck, open Profile, Settings, and Your devices, then choose WHOOP.',
          'On the Connect WHOOP sheet, tap Connect WHOOP, sign in, and approve the requested account access.',
          'For live BPM, open WHOOP Device Settings, turn on Broadcast Heart Rate, then choose Pair live heart rate in PulseCheck.',
          'Return to the PulseCheck home screen and confirm the device card shows WHOOP live.',
        ],
        verified: 'The PulseCheck home device card shows WHOOP live once a recent WHOOP cloud record is reporting; live BPM also appears when Heart Rate Broadcast is paired.',
        troubleshooting: [
          'Sync the WHOOP app first, then refresh PulseCheck.',
          'For live BPM, keep Heart Rate Broadcast on and the strap close to the iPhone.',
          'If account authorization expired, reconnect WHOOP from the device screen.',
        ],
      },
      android: {
        summary: 'Connect your WHOOP account so PulseCheck can refresh the recovery data you approved.',
        requirements: ['WHOOP app and account', 'WHOOP charged and connected', 'A recent WHOOP sync'],
        steps: [
          'Open the WHOOP app and confirm your strap has finished syncing.',
          'In PulseCheck, go to Profile, open Your devices, then choose WHOOP.',
          'Sign in to WHOOP and approve the requested account access.',
          'Return to PulseCheck when the authorization page finishes.',
          'Open Sports Intel and confirm the latest WHOOP recovery or sleep record appears.',
        ],
        verified: 'PulseCheck shows WHOOP as reporting and displays a recent recovery, strain, sleep, or HRV record.',
        troubleshooting: [
          'Sync the WHOOP app first, then refresh PulseCheck.',
          'Allow WHOOP to run in the background if Android battery settings are delaying its sync.',
          'If account authorization expired, reconnect WHOOP from the device screen.',
        ],
      },
    },
  },
];

const platformLabels: Record<Platform, string> = {
  ios: 'iPhone',
  android: 'Android',
};

const CAPTURE_ROOT = '/pulsecheck-wearable-guide';

const capture = (
  file: string,
  alt: string,
  label: string,
  detail: string,
  frame: StepCapture['frame'] = 'phone'
): StepCapture => ({
  kind: 'capture',
  src: `${CAPTURE_ROOT}/${file}`,
  alt,
  label,
  detail,
  frame,
});

const reference = (
  label: string,
  detail: string,
  href?: string,
  linkLabel?: string
): StepReference => ({
  kind: 'reference',
  label,
  detail,
  href,
  linkLabel,
});

const stepVisuals: Partial<Record<`${DeviceId}-${Platform}`, Array<StepVisual | null>>> = {
  'apple-watch-ios': [
    capture(
      'ios-apple-health-app.webp',
      'The real Apple Health app on iPhone',
      'Apple Health app',
      'Tap the Health icon shown here, then confirm your Apple Watch has a recent heart-rate, sleep, or activity record before connecting PulseCheck.'
    ),
    capture(
      'ios-device-picker.webp',
      'The real PulseCheck Your devices screen on iPhone, including the Apple Watch connection card',
      'PulseCheck for iPhone',
      'This capture comes from the current PulseCheck iPhone app. Choose Apple Watch on this screen.'
    ),
    capture(
      'ios-apple-watch-connect.webp',
      'The real Connect Apple Watch sheet in the PulseCheck iPhone app',
      'PulseCheck for iPhone',
      'This is the connection sheet PulseCheck shows before iOS opens Health access.'
    ),
    reference(
      'iPhone Health access sheet',
      'iOS generates this screen and groups requested health data by category. Review each category and choose what you want PulseCheck to read.',
      'https://developer.apple.com/documentation/HealthKit/authorizing-access-to-health-data',
      'See Apple\'s authorization guide'
    ),
    capture(
      'ios-home-apple-health-connected.webp',
      'The real PulseCheck home device card showing Apple Health connected',
      'PulseCheck home',
      'Use the home device card as the connection check. It should show Apple Health as connected before you expect Sports Intel to read from the latest sync.',
      'card'
    ),
  ],
  'health-connect-android': [
    reference(
      'Your watch app and Health Connect',
      'Your watch or its companion app must write a recent record before PulseCheck can read it.',
      'https://support.google.com/android/answer/12201230',
      'Open Google\'s Health Connect guide'
    ),
    capture(
      'android-device-picker.webp',
      'The real PulseCheck Your devices screen on Android, including the Health Connect card',
      'PulseCheck for Android',
      'This capture comes from the current PulseCheck Android app.'
    ),
    capture(
      'android-device-picker.webp',
      'The real PulseCheck Android device list with Health Connect available to connect',
      'PulseCheck for Android',
      'Tap the Health Connect card shown in the lower half of this screen.'
    ),
    capture(
      'android-health-connect-get-started.webp',
      'The real Android Get started with Health Connect system screen',
      'Android system screen',
      'Android shows this page when Health Connect still needs its first-time setup. If it is already set up, Android may go directly to permissions.'
    ),
    reference(
      'A real Health Connect record',
      'We do not stage a successful connection. Confirm that Sports Intel shows a recent record from the watch or health app you actually connected.'
    ),
  ],
  'polar-ios': [
    capture(
      'ios-polar-01-charge.webp',
      'The real first Polar setup screen in PulseCheck that says Charge your Polar',
      'PulseCheck Polar walkthrough, 1 of 6',
      'This is the first screen in the current iPhone walkthrough.'
    ),
    capture(
      'ios-polar-02-wear.webp',
      'The real second Polar setup screen in PulseCheck that explains wrist placement',
      'PulseCheck Polar walkthrough, 2 of 6',
      'Follow the fit shown in PulseCheck before continuing.'
    ),
    capture(
      'ios-polar-03-bluetooth.webp',
      'The real third Polar setup screen in PulseCheck that explains how to turn on iPhone Bluetooth',
      'PulseCheck Polar walkthrough, 3 of 6',
      'Return to PulseCheck after Bluetooth is on.'
    ),
    capture(
      'ios-polar-04-find.webp',
      'The real fourth Polar setup screen in PulseCheck scanning for nearby Polar sensors',
      'PulseCheck Polar walkthrough, 4 of 6',
      'Only select the sensor that belongs to you.'
    ),
    reference(
      'A broadcasting Polar sensor is required',
      'The Connecting screen appears only after PulseCheck finds and selects real Polar hardware. A successful pairing is not simulated here.'
    ),
    reference(
      'A real heart-rate sample is required',
      'The final screen appears only after PulseCheck receives live BPM from the paired Polar. A made-up reading is intentionally not shown.'
    ),
  ],
  'polar-android': [
    reference(
      'Charged, awake Polar sensor',
      'Keep your real sensor charged, awake, and within arm\'s reach of the Android phone.'
    ),
    capture(
      'android-device-picker.webp',
      'The real PulseCheck Your devices screen on Android with the Polar connection card',
      'PulseCheck for Android',
      'Choose Polar from the current Android device screen.'
    ),
    reference(
      'Android Nearby devices permission',
      'Android generates this permission screen for your phone and OS version. Allow PulseCheck to find nearby devices when it appears.'
    ),
    reference(
      'A broadcasting Polar sensor is required',
      'The sensor list appears only while real Polar hardware is broadcasting nearby. A device result is not simulated.'
    ),
    reference(
      'A real heart-rate sample is required',
      'Confirm live BPM from your own paired sensor. A staged heart-rate result is intentionally not shown.'
    ),
  ],
  'fitbit-ios': [
    reference(
      'Google Health device sync',
      'Confirm Fitbit Air is listed in Google Health and that its latest sync has finished before connecting PulseCheck.',
      'https://support.google.com/googlehealth/answer/14237221',
      'Open Google\'s device sync guide'
    ),
    capture(
      'ios-device-picker.webp',
      'The real PulseCheck Your devices screen on iPhone with the Fitbit Air setup card',
      'PulseCheck for iPhone',
      'Tap Set up Fitbit Air on this current PulseCheck screen.'
    ),
    capture(
      'ios-fitbit-connect.webp',
      'The real Connect Fitbit Air sheet in the PulseCheck iPhone app',
      'PulseCheck for iPhone',
      'This is the sheet PulseCheck shows before the Google sign-in handoff.'
    ),
    reference(
      'Your Google authorization screen',
      'Google generates this screen for the account you choose. Use the same Google account that owns the Fitbit Air and review the requested access.'
    ),
    capture(
      'ios-home-fitbit-connected.webp',
      'The real PulseCheck home device card showing Fitbit Air live',
      'PulseCheck home',
      'Use the home device card as the connection check. It should show Fitbit Air live before you expect downstream source data to appear.',
      'card'
    ),
  ],
  'fitbit-android': [
    reference(
      'Google Health device sync',
      'Confirm Fitbit Air is listed in Google Health and that its latest sync has finished before connecting PulseCheck.',
      'https://support.google.com/googlehealth/answer/14237221',
      'Open Google\'s device sync guide'
    ),
    capture(
      'android-device-picker.webp',
      'The real PulseCheck Your devices screen on Android with the Fitbit Air setup card',
      'PulseCheck for Android',
      'This capture comes from the current Android app.'
    ),
    capture(
      'android-device-picker.webp',
      'The real PulseCheck Android device list showing Set up Fitbit Air',
      'PulseCheck for Android',
      'Tap Set up Fitbit Air at the top of this screen.'
    ),
    reference(
      'Your Google authorization screen',
      'Google generates this screen for the account you choose. Use the same Google account that owns the Fitbit Air and review the requested access.'
    ),
    reference(
      'A real Fitbit source record',
      'We do not stage a reporting status. Confirm that Sports Intel shows a recent record from the Fitbit Air you actually connected.'
    ),
  ],
  'oura-ios': [
    capture(
      'ios-oura-01-wear.webp',
      'The real first Oura setup screen in PulseCheck showing how to wear the ring',
      'PulseCheck Oura walkthrough, 1 of 4',
      'This is the first screen in the current iPhone walkthrough.'
    ),
    capture(
      'ios-oura-02-sync.webp',
      'The real second Oura setup screen in PulseCheck with instructions to sync the Oura app',
      'PulseCheck Oura walkthrough, 2 of 4',
      'The three on-screen checks explain exactly when to return to PulseCheck.'
    ),
    capture(
      'ios-oura-03-sign-in.webp',
      'The real third Oura setup screen in PulseCheck before secure Oura sign-in',
      'PulseCheck Oura walkthrough, 3 of 4',
      'Oura handles the password and authorization after you tap Open Oura.'
    ),
    reference(
      'A real Oura authorization is required',
      'The Oura is connected screen appears only after your own Oura account authorizes PulseCheck. A successful account connection is not simulated.'
    ),
  ],
  'oura-android': [
    reference(
      'Your Oura app',
      'Let the ring finish a real sync in the Oura app before opening PulseCheck.',
      'https://support.ouraring.com/hc/en-us/articles/42986776499347-Set-Up-the-Oura-App',
      'Open Oura\'s setup guide'
    ),
    capture(
      'android-device-picker.webp',
      'The real PulseCheck Your devices screen on Android with the Oura Ring card',
      'PulseCheck for Android',
      'Choose Oura Ring from this current Android screen.'
    ),
    reference(
      'Your Oura authorization screen',
      'Oura generates the secure sign-in for your account. Review and approve the requested access there.'
    ),
    reference(
      'Return from Oura to PulseCheck',
      'The authorization page returns to PulseCheck after your real account completes the handoff.'
    ),
    reference(
      'A real Oura source record',
      'Confirm a recent Oura sleep, readiness, or recovery record from the ring you actually connected.'
    ),
  ],
  'whoop-ios': [
    reference(
      'Your WHOOP app',
      'Wait for the strap to finish its real sync before connecting the WHOOP account to PulseCheck.',
      'https://support.whoop.com/s/article/Navigating-the-WHOOP-Mobile-App?language=en_US',
      'Open WHOOP device settings help'
    ),
    capture(
      'ios-whoop-connect.webp',
      'The real Connect WHOOP sheet in the PulseCheck iPhone app',
      'PulseCheck for iPhone',
      'This is the current PulseCheck screen for account data and optional live heart rate.'
    ),
    reference(
      'Your WHOOP authorization screen',
      'WHOOP generates the secure sign-in for your account. Review and approve the requested access there.'
    ),
    capture(
      'ios-whoop-live-pairing.webp',
      'The real WHOOP live heart-rate pairing sheet in PulseCheck',
      'PulseCheck for iPhone',
      'This screen appears after Pair live heart rate. It searches only while your strap is broadcasting.'
    ),
    capture(
      'ios-home-whoop-connected.webp',
      'The real PulseCheck home device card showing WHOOP live',
      'PulseCheck home',
      'Use the home device card as the connection check. WHOOP appears live only after WHOOP has processed and synced your own data.',
      'card'
    ),
  ],
  'whoop-android': [
    reference(
      'Your WHOOP app',
      'Wait for the strap to finish its real sync before connecting the WHOOP account to PulseCheck.',
      'https://support.whoop.com/s/article/Navigating-the-WHOOP-Mobile-App?language=en_US',
      'Open WHOOP device settings help'
    ),
    capture(
      'android-device-picker-lower.webp',
      'The lower half of the real PulseCheck Android device list showing the WHOOP card',
      'PulseCheck for Android',
      'Choose WHOOP from this current Android screen.'
    ),
    reference(
      'Your WHOOP authorization screen',
      'WHOOP generates the secure sign-in for your account. Review and approve the requested access there.'
    ),
    reference(
      'Return from WHOOP to PulseCheck',
      'The authorization page returns to PulseCheck after your real account completes the handoff.'
    ),
    reference(
      'A real WHOOP source record',
      'Confirm a recent recovery, strain, sleep, or HRV record from the WHOOP strap you actually connected.'
    ),
  ],
};

const getStepVisuals = (device: DeviceGuide, platform: Platform): Array<StepVisual | null> =>
  stepVisuals[`${device.id}-${platform}`] ?? [];

const StepVisualCard: React.FC<{ visual: StepCapture; stepNumber: number }> = ({ visual, stepNumber }) => (
  <figure className={styles.stepCapture}>
    <figcaption>
      <span>{visual.label}</span>
      <span>Actual screen</span>
    </figcaption>
    <a
      className={`${styles.captureLink} ${visual.frame === 'card' ? styles.captureLinkCard : ''}`}
      href={visual.src}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open the full-size screen for step ${stepNumber}`}
    >
      <img src={visual.src} alt={visual.alt} loading="lazy" decoding="async" />
      <span className={styles.captureExpand}>
        <ExternalLink size={14} aria-hidden="true" />
        Full size
      </span>
    </a>
    <p>{visual.detail}</p>
  </figure>
);

const WearablesSetupPage: React.FC = () => {
  const [platform, setPlatform] = useState<Platform>('ios');
  const [selectedDeviceId, setSelectedDeviceId] = useState<DeviceId>('apple-watch');

  useEffect(() => {
    if (platformDetection.isAndroid()) {
      setPlatform('android');
      setSelectedDeviceId('health-connect');
    }
  }, []);

  const selectedDevice = useMemo(
    () => deviceGuides.find((device) => device.id === selectedDeviceId) ?? deviceGuides[0],
    [selectedDeviceId]
  );
  const availableDevices = useMemo(
    () => deviceGuides.filter((device) => device.supportedOn.includes(platform)),
    [platform]
  );
  const setup = selectedDevice.setup[platform];
  const currentStepVisuals = useMemo(() => getStepVisuals(selectedDevice, platform), [selectedDevice, platform]);
  const isSupported = selectedDevice.supportedOn.includes(platform);
  const storeUrl = platform === 'ios' ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;

  const choosePlatform = (nextPlatform: Platform) => {
    setPlatform(nextPlatform);
    if (nextPlatform === 'ios' && selectedDeviceId === 'health-connect') setSelectedDeviceId('apple-watch');
    if (nextPlatform === 'android' && selectedDeviceId === 'apple-watch') setSelectedDeviceId('health-connect');
  };

  return (
    <div className={styles.page}>
      <Head>
        <title>Wearable Setup | PulseCheck</title>
        <meta
          name="description"
          content="Set up Apple Watch, Health Connect, Polar, Fitbit, Oura, or WHOOP with PulseCheck on iPhone or Android."
        />
        <meta property="og:title" content="Wearable Setup | PulseCheck" />
        <meta
          property="og:description"
          content="Choose your phone and wearable, then follow the complete PulseCheck connection guide."
        />
        <meta property="og:image" content="https://fitwithpulse.ai/pulsecheck-wearable-guide-og.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://fitwithpulse.ai/pulsecheck-wearable-guide-og.png" />
      </Head>

      <header className={styles.header}>
        <Link href="/PulseCheck" className={styles.brandLink} aria-label="PulseCheck home">
          <img src="/pulsecheck-youth/pulsecheck-wordmark.png" alt="PulseCheck" className={styles.wordmark} />
        </Link>
        <div className={styles.headerActions}>
          <span className={styles.accountLabel}>Account setup</span>
          <a className={styles.headerAppLink} href={PULSECHECK_APP_URL}>
            <Smartphone size={16} aria-hidden="true" />
            Open app
          </a>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.intro} aria-labelledby="page-title">
          <div>
            <div className={styles.eyebrow}>Wearable setup center</div>
            <h1 id="page-title">Connect what you wear.</h1>
            <p>
              Choose your phone and device. We will take you from the first permission to a verified data record in
              PulseCheck.
            </p>
          </div>

          <div className={styles.platformBlock}>
            <span className={styles.controlLabel}>Which phone runs PulseCheck?</span>
            <div className={styles.segmentedControl} role="tablist" aria-label="Phone platform">
              {(['ios', 'android'] as Platform[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={platform === item}
                  className={platform === item ? styles.segmentActive : styles.segment}
                  onClick={() => choosePlatform(item)}
                >
                  <Smartphone size={16} aria-hidden="true" />
                  {platformLabels[item]}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.progressRail} aria-label="Setup flow">
          {['Choose your device', 'Connect your account', 'Confirm recent data'].map((label, index) => (
            <div className={styles.progressItem} key={label}>
              <span>{index + 1}</span>
              {label}
            </div>
          ))}
        </div>

        <div className={styles.workspace}>
          <aside className={styles.devicePanel} aria-label="Choose a wearable">
            <div className={styles.panelHeading}>
              <span>Your device</span>
              <span>{availableDevices.length} supported</span>
            </div>
            <div className={styles.deviceList}>
              {availableDevices.map((device) => {
                const active = device.id === selectedDevice.id;
                const itemStyle = { '--device-accent': device.accent } as React.CSSProperties;

                return (
                  <button
                    type="button"
                    key={device.id}
                    className={`${styles.deviceButton} ${active ? styles.deviceButtonActive : ''}`}
                    style={itemStyle}
                    onClick={() => setSelectedDeviceId(device.id)}
                    aria-pressed={active}
                  >
                    <span className={styles.deviceThumb}>
                      {device.image ? (
                        <img src={device.image} alt="" />
                      ) : (
                        <Watch size={28} strokeWidth={1.7} aria-hidden="true" />
                      )}
                    </span>
                    <span className={styles.deviceButtonCopy}>
                      <strong>{device.shortName}</strong>
                      <small>{device.signal}</small>
                    </span>
                    <Check className={styles.deviceCheck} size={17} aria-label="Supported" />
                  </button>
                );
              })}
            </div>
          </aside>

          <article
            className={styles.guide}
            style={{ '--accent': selectedDevice.accent } as React.CSSProperties}
            aria-live="polite"
          >
            <div className={styles.guideTop}>
              <div className={styles.productVisual}>
                {selectedDevice.image ? (
                  <img src={selectedDevice.image} alt={selectedDevice.name} />
                ) : (
                  <Watch size={92} strokeWidth={1.25} aria-hidden="true" />
                )}
              </div>

              <div className={styles.guideIntro}>
                <div className={styles.statusRow}>
                  <span className={isSupported ? styles.supportedBadge : styles.unavailableBadge}>
                    {isSupported ? <BadgeCheck size={15} aria-hidden="true" /> : <CircleHelp size={15} aria-hidden="true" />}
                    {isSupported ? `Supported on ${platformLabels[platform]}` : `Requires ${platform === 'ios' ? 'Android' : 'iPhone'}`}
                  </span>
                  <span>{setup.steps.length} steps</span>
                </div>
                <h2>{selectedDevice.name}</h2>
                <p>{setup.summary}</p>

                <div className={styles.requirements}>
                  <div className={styles.requirementsTitle}>
                    <LockKeyhole size={15} aria-hidden="true" />
                    Before you start, make sure you have the following completed
                  </div>
                  <ul>
                    {setup.requirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className={styles.guideBody}>
              <section className={styles.stepsSection} aria-labelledby="setup-steps-title">
                <div className={styles.sectionKicker}>{platformLabels[platform]} walkthrough</div>
                <h3 id="setup-steps-title">Set it up in order</h3>
                <ol className={styles.stepsList}>
                  {setup.steps.map((step, index) => (
                    <li key={step}>
                      <span className={styles.stepNumber}>{index + 1}</span>
                      <div className={styles.stepCopy}>
                        <p>{step}</p>
                      </div>
                      {currentStepVisuals[index]?.kind === 'capture' && (
                        <StepVisualCard visual={currentStepVisuals[index]} stepNumber={index + 1} />
                      )}
                    </li>
                  ))}
                </ol>

                <div className={styles.actionRow}>
                  {isSupported && selectedDevice.action ? (
                    <Link href={selectedDevice.action.href} className={styles.primaryAction}>
                      {selectedDevice.action.label}
                      <ArrowRight size={17} aria-hidden="true" />
                    </Link>
                  ) : isSupported ? (
                    <a href={PULSECHECK_APP_URL} className={styles.primaryAction}>
                      Open PulseCheck
                      <ArrowRight size={17} aria-hidden="true" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      className={styles.primaryAction}
                      onClick={() => choosePlatform(platform === 'ios' ? 'android' : 'ios')}
                    >
                      Switch to {platform === 'ios' ? 'Android' : 'iPhone'}
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  )}

                  {isSupported && selectedDevice.action && (
                    <a href={PULSECHECK_APP_URL} className={styles.secondaryAction}>
                      Open the app
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                  )}
                </div>
                {isSupported && (
                  <p className={styles.appPath}>
                    In the app: Profile <span>/</span> {platform === 'ios' ? 'Settings' : 'Devices'} <span>/</span>{' '}
                    {selectedDevice.shortName}
                  </p>
                )}
              </section>

              <aside className={styles.confirmationColumn}>
                <section className={styles.verifiedBlock}>
                  <div className={styles.verifiedIcon}>
                    <HeartPulse size={22} aria-hidden="true" />
                  </div>
                  <div className={styles.sectionKicker}>Done looks like this</div>
                  <h3>Confirm the data, not just the login.</h3>
                  <p>{setup.verified}</p>
                </section>

                <details className={styles.helpBlock}>
                  <summary>
                    <span>
                      <CircleHelp size={18} aria-hidden="true" />
                      Connection not showing?
                    </span>
                    <ChevronDown size={18} aria-hidden="true" />
                  </summary>
                  <ul>
                    {setup.troubleshooting.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <a href={selectedDevice.officialHelp.href} target="_blank" rel="noreferrer">
                    {selectedDevice.officialHelp.label}
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                </details>

                <a className={styles.storeLink} href={storeUrl} target="_blank" rel="noreferrer">
                  <Smartphone size={18} aria-hidden="true" />
                  <span>
                    <small>Need the app?</small>
                    Get PulseCheck for {platformLabels[platform]}
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </aside>
            </div>
          </article>
        </div>

        <section className={styles.privacyNote}>
          <LockKeyhole size={20} aria-hidden="true" />
          <div>
            <strong>You choose what to share.</strong>
            <p>
              Device connections are optional. You can review or revoke access later in PulseCheck and in the health
              service connected to your device.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default WearablesSetupPage;
