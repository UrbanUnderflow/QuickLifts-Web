import type { User as FirebaseAuthUser } from 'firebase/auth';
import {
  CheckinsPrivacy,
  SubscriptionPlatform,
  SubscriptionType,
  User,
} from '../user';
import { userService } from '../user';
import { claimUsername, isValidUsernameFormat, normalizeUsername } from './username';

const EMPTY_PROFILE_IMAGE = {
  profileImageURL: '',
  imageOffsetWidth: 0,
  imageOffsetHeight: 0,
};

interface BuildAthleteProfileArgs {
  firebaseUser: FirebaseAuthUser;
  email: string;
  username: string;
  existingUser?: User | null;
}

export interface ResolveCheckInProfileResultReady {
  status: 'ready';
  user: User;
}

export interface ResolveCheckInProfileResultNeedsUsername {
  status: 'needs-username';
  email: string;
  existingUser: User | null;
  suggestedUsername: string;
}

export type ResolveCheckInProfileResult =
  | ResolveCheckInProfileResultReady
  | ResolveCheckInProfileResultNeedsUsername;

const toSerializableValue = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  return typeof (value as { toDictionary?: () => Record<string, unknown> }).toDictionary === 'function'
    ? (value as { toDictionary: () => Record<string, unknown> }).toDictionary()
    : value;
};

const toPlainBodyWeight = (bodyWeight: unknown[] | undefined) =>
  bodyWeight?.map((weight) =>
    typeof (weight as { toDictionary?: () => Record<string, unknown> }).toDictionary === 'function'
      ? (weight as { toDictionary: () => Record<string, unknown> }).toDictionary()
      : weight
  ) || [];

const buildAthleteUserPatch = (profile: User) => ({
  email: profile.email,
  username: profile.username,
  displayName: profile.displayName,
  role: profile.role,
  registrationComplete: profile.registrationComplete,
  subscriptionType: profile.subscriptionType,
  subscriptionPlatform: profile.subscriptionPlatform,
  encouragement: profile.encouragement || [],
  blockedUsers: profile.blockedUsers || [],
  goal: profile.goal || [],
  bodyWeight: toPlainBodyWeight(profile.bodyWeight),
  macros: profile.macros || {},
  creator: profile.creator ? profile.creator.toDictionary() : null,
  winner: profile.winner ? profile.winner.toDictionary() : null,
  checkinsPrivacy: profile.checkinsPrivacy,
  checkinsAccessList: profile.checkinsAccessList || [],
  updatedAt: profile.updatedAt,
  ...(profile.profileImage?.profileImageURL
    ? { profileImage: profile.profileImage.toDictionary() }
    : {}),
});

export const buildAthleteUserProfile = ({
  firebaseUser,
  email,
  username,
  existingUser,
}: BuildAthleteProfileArgs): User => {
  const now = new Date();
  const baseUser = existingUser?.toDictionary() || {};
  const normalizedUsername = normalizeUsername(username);
  const normalizedExistingUsername = normalizeUsername(existingUser?.username || '');

  return new User(firebaseUser.uid, {
    ...baseUser,
    id: firebaseUser.uid,
    email,
    username: normalizedUsername,
    displayName:
      existingUser?.displayName ||
      firebaseUser.displayName ||
      normalizedExistingUsername ||
      normalizedUsername,
    role: existingUser?.role || 'athlete',
    registrationComplete: true,
    subscriptionType: existingUser?.subscriptionType || SubscriptionType.unsubscribed,
    subscriptionPlatform: existingUser?.subscriptionPlatform || SubscriptionPlatform.Web,
    profileImage: existingUser?.profileImage?.toDictionary?.() || EMPTY_PROFILE_IMAGE,
    encouragement: existingUser?.encouragement || [],
    blockedUsers: existingUser?.blockedUsers || [],
    goal: existingUser?.goal || [],
    bodyWeight: existingUser?.bodyWeight?.map((weight) =>
      typeof (weight as { toDictionary?: () => Record<string, unknown> }).toDictionary === 'function'
        ? (weight as { toDictionary: () => Record<string, unknown> }).toDictionary()
        : weight
    ) || [],
    macros: existingUser?.macros || {},
    creator: toSerializableValue(existingUser?.creator) || null,
    winner: toSerializableValue(existingUser?.winner) || null,
    checkinsPrivacy: existingUser?.checkinsPrivacy || CheckinsPrivacy.privateOnly,
    checkinsAccessList: existingUser?.checkinsAccessList || [],
    createdAt: existingUser?.createdAt || now,
    updatedAt: now,
  });
};

export const createOrRepairAthleteUserProfile = async ({
  firebaseUser,
  email,
  username,
  existingUser,
  claimRequestedUsername,
}: BuildAthleteProfileArgs & { claimRequestedUsername: boolean }): Promise<User> => {
  const normalizedUsername = normalizeUsername(username);

  if (!isValidUsernameFormat(normalizedUsername)) {
    throw new Error('Invalid username format');
  }

  const profile = buildAthleteUserProfile({
    firebaseUser,
    email,
    username: normalizedUsername,
    existingUser,
  });

  if (claimRequestedUsername) {
    await claimUsername(firebaseUser.uid, normalizedUsername);
  }

  if (!existingUser) {
    await userService.createUser(firebaseUser.uid, profile);
  } else {
    await userService.updateUser(firebaseUser.uid, buildAthleteUserPatch(profile));
  }
  userService.nonUICurrentUser = profile;

  return profile;
};

export const resolveCheckInUserProfile = async ({
  firebaseUser,
  requestedUsername,
  suggestedUsername,
}: {
  firebaseUser: FirebaseAuthUser;
  requestedUsername?: string;
  suggestedUsername: string;
}): Promise<ResolveCheckInProfileResult> => {
  const existingUser = await userService.fetchUserFromFirestore(firebaseUser.uid);
  const email = existingUser?.email || firebaseUser.email;

  if (!email) {
    throw new Error('Email is required to complete check-in.');
  }

  const normalizedExistingUsername = normalizeUsername(existingUser?.username || '');
  const hasValidExistingUsername = isValidUsernameFormat(normalizedExistingUsername);

  if (!requestedUsername && !hasValidExistingUsername) {
    return {
      status: 'needs-username',
      email,
      existingUser,
      suggestedUsername,
    };
  }

  const targetUsername = normalizeUsername(requestedUsername || normalizedExistingUsername);
  const shouldRepairProfile =
    !existingUser ||
    !!requestedUsername ||
    !existingUser.registrationComplete ||
    !existingUser.email ||
    !existingUser.displayName;

  if (shouldRepairProfile) {
    const repairedUser = await createOrRepairAthleteUserProfile({
      firebaseUser,
      email,
      username: targetUsername,
      existingUser,
      claimRequestedUsername: !hasValidExistingUsername || !!requestedUsername,
    });

    return {
      status: 'ready',
      user: repairedUser,
    };
  }

  userService.nonUICurrentUser = existingUser;

  return {
    status: 'ready',
    user: existingUser,
  };
};
