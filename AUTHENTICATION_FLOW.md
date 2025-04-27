# Pulse Web Authentication & Redirect Flow

This document outlines the authentication flow for the Pulse web application, detailing how users are handled when accessing protected routes and how redirects occur after sign-in, especially concerning round invitations.

## Core Components

1.  **`AuthWrapper.tsx`**: The primary component responsible for managing authentication state across the application.
2.  **`SignInModal.tsx`**: Handles user sign-in, sign-up, password reset, and the onboarding quiz.
3.  **`ChallengeCTA.tsx`**: Component shown on round invitation pages, allowing users to initiate the joining process.
4.  **`tempRedirectSlice.ts`**: A Redux slice used to temporarily store redirect context across different components during the authentication flow.
5.  **Protected Routes**: Pages like `/round/[id]` that require user authentication.
6.  **Public/Invitation Routes**: Pages like `/round-invitation/[id]` that are publicly accessible but may lead to protected actions.

## `AuthWrapper` Responsibilities

-   **Listens to Auth State**: Uses Firebase's `onAuthStateChanged` to monitor the user's login status.
-   **Fetches User Data**: When a Firebase user is detected, it fetches the corresponding user profile from Firestore using `userService.fetchUserFromFirestore`.
-   **Updates Global State**: Dispatches actions to update the `userSlice` in Redux with the fetched user data (or `null` if logged out).
-   **Route Protection**: Checks if the current route (`router.pathname` / `router.asPath`) is a protected route.
-   **Modal Triggering**: If the user is **not authenticated** and tries to access a **protected route**:
    -   It dispatches `setLoginRedirectPath(router.asPath)` to the `tempRedirectSlice`, storing the path the user *intended* to visit (e.g., `/round/some-challenge-id`).
    -   It sets state to display the `SignInModal`.
-   **Handles Other Modals**: It also handles showing modals for subscription requirements or incomplete onboarding if the user *is* authenticated but lacks necessary permissions/data for a route.
-   **Renders Children**: If the user is authenticated and meets any other route requirements, it renders the requested page (`children`).

## Redirect Scenarios & `tempRedirectSlice`

After a user successfully authenticates (signs in or completes the quiz), we need to ensure they land on the correct page. The `tempRedirectSlice` helps manage this context without cluttering the `/sign-in` URL with query parameters.

The slice holds two key pieces of state:

-   `roundIdRedirect: string | null`: Stores the ID of a specific round if the user initiated the sign-in flow from a round invitation (`ChallengeCTA`).
-   `loginRedirectPath: string | null`: Stores the full path (e.g., `/round/some-challenge-id`) if the user landed directly on a protected route while logged out (`AuthWrapper` sets this).

**Why is this needed?**

-   The `ChallengeCTA` component (on the invitation page) knows the specific `roundId` the user wants to join.
-   The `AuthWrapper` knows the generic path the user tried to access if they hit a protected route directly.
-   The `SignInModal` needs to know which of these contexts (invitation vs. direct access) triggered the sign-in flow to perform the correct post-authentication action (auto-join vs. simply closing).

**Note:** The reducers in `tempRedirectSlice` are designed so that setting one redirect type (`setRoundIdRedirect`) automatically clears the other (`loginRedirectPath`) and vice-versa, preventing conflicts.

## Component Interaction Flows

### Scenario 1: Direct Access to Protected Route (e.g., `/round/XYZ`)

1.  User navigates directly to `/round/XYZ`.
2.  `AuthWrapper` detects this is a protected route.
3.  `AuthWrapper` checks Firebase auth state; finds no logged-in user.
4.  `AuthWrapper` dispatches `setLoginRedirectPath('/round/XYZ')` to Redux.
5.  `AuthWrapper` shows the `SignInModal`.
6.  User successfully signs in within the `SignInModal`.
7.  `SignInModal` (`handleSignInSuccess`) checks the `tempRedirectSlice` state:
    -   Finds `roundIdRedirect` is `null`.
    -   Finds `loginRedirectPath` is `/round/XYZ`.
8.  `SignInModal` dispatches `clearLoginRedirectPath()`.
9.  `SignInModal` calls `onClose()`. The modal disappears.
10. `AuthWrapper` re-evaluates: now sees an authenticated user and renders its children, which is the originally requested `/round/XYZ` page.

### Scenario 2: Access via Round Invitation (`/round-invitation/ABC`)

1.  User is on `/round-invitation/ABC`.
2.  User clicks the "I'm on a laptop or Android Device" button within `ChallengeCTA`.
3.  `ChallengeCTA` (`handleWebApp`) dispatches `setRoundIdRedirect('ABC')` to Redux.
4.  `ChallengeCTA` navigates the user to `/round/ABC`.
5.  `AuthWrapper` detects `/round/ABC` is a protected route.
6.  `AuthWrapper` checks Firebase auth state; finds no logged-in user.
7.  `AuthWrapper` dispatches `setLoginRedirectPath('/round/ABC')`. **Important:** This clears the `roundIdRedirect` set in step 3 due to the slice logic.
8.  `AuthWrapper` shows the `SignInModal`.
9.  User successfully signs in within the `SignInModal`.
10. `SignInModal` (`handleSignInSuccess`) checks the `tempRedirectSlice` state:
    -   Finds `roundIdRedirect` is `null`.
    -   Finds `loginRedirectPath` is `/round/ABC`.
11. `SignInModal` dispatches `clearLoginRedirectPath()`.
12. `SignInModal` calls `onClose()`. The modal disappears.
13. `AuthWrapper` re-evaluates and renders the `/round/ABC` page.

**Correction & Refinement based on Step 7:** The above flow highlights a potential issue where `AuthWrapper` overwrites the invitation context. The *intended* logic relies on the **priority check within `SignInModal`**: `SignInModal` reads *both* states *before* deciding. Even if `AuthWrapper` sets `loginRedirectPath`, `SignInModal` should prioritize `roundIdRedirect` *if it was set*. We need to ensure the state isn't cleared prematurely.

**Let's re-trace Scenario 2 assuming `SignInModal` reads state correctly:**

1.  User on `/round-invitation/ABC`. Clicks button.
2.  `ChallengeCTA` dispatches `setRoundIdRedirect('ABC')`. Navigates to `/round/ABC`.
3.  `AuthWrapper` sees `/round/ABC`, user not logged in.
4.  `AuthWrapper` dispatches `setLoginRedirectPath('/round/ABC')`. (Assume `roundIdRedirect` might still be 'ABC' briefly depending on Redux update timing relative to the next step, or potentially cleared).
5.  `AuthWrapper` shows `SignInModal`.
6.  `SignInModal` mounts/renders. It reads *both* `roundIdRedirect` and `loginRedirectPath` from the current Redux state using `useSelector`.
7.  User successfully signs in.
8.  `SignInModal` (`handleSignInSuccess`) executes its logic:
    -   **Checks `roundIdRedirect` first.** If it's 'ABC' (meaning the state update from `ChallengeCTA` is the latest relevant one): 
        -   Calls `autoJoinChallenge('ABC')`.
        -   Dispatches `clearRoundIdRedirect()`.
        -   Calls `onClose()`.
    -   **Else if `loginRedirectPath` exists:** (This would happen if `roundIdRedirect` was null or cleared)
        -   Dispatches `clearLoginRedirectPath()`.
        -   Calls `onClose()`.
    -   **Else:** (Fallback)
        -   Calls `onClose()`.
9.  Modal disappears.
10. `AuthWrapper` renders the `/round/ABC` page.

This prioritisation within `SignInModal` is crucial.

## Post-Authentication Actions in `SignInModal`

-   **Primary Action**: After successful sign-in or quiz completion, the main action is usually just calling `onClose()`. This removes the modal and allows the `AuthWrapper` (which now sees an authenticated user) to render the correct underlying page based on the current URL.
-   **Auto-Join**: If the `roundIdRedirect` state was present (indicating an invitation flow), the `autoJoinChallenge(roundId)` function is called *before* `onClose()`. This function:
    -   Checks if the user is already part of that specific challenge using `workoutService.fetchUserChallengesByUserId`.
    -   If already joined, shows an info toast.
    -   If not joined, calls `workoutService.joinChallenge`.
    -   Shows success or error toasts via `toastSlice`.
-   **`/subscribe` Redirect**: An exception to the `onClose()` rule is within `handleCompleteQuiz`. If the user completes the quiz and their `refreshedUser.subscriptionType` is `unsubscribed` (and there was no specific `roundIdRedirect`), they are explicitly navigated to `/subscribe`.

## Summary

The flow uses `AuthWrapper` to guard routes and trigger the `SignInModal`. The `tempRedirectSlice` passes context (invitation ID or direct access path) to `SignInModal`. `SignInModal` prioritizes this context to perform actions like auto-joining a challenge before simply closing itself to let `AuthWrapper` render the appropriate page. 