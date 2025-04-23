# Contributing to Pulse (formerly QuickLifts)

First off, thank you for considering contributing to Pulse! It's people like you that make Pulse such a great community and fitness tool.

This document provides guidelines for contributing to the project. Please feel free to propose changes to this document in a pull request.

## How Can I Contribute?

### Reporting Bugs

- **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/tremainegrant/QuickLifts-Web/issues).
- If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/tremainegrant/QuickLifts-Web/issues/new). Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample or an executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

- Open a new issue with the label `enhancement`.
- Clearly describe the enhancement and the motivation for it.
- Explain why this enhancement would be useful to other Pulse users.
- Provide code examples if applicable.

### Pull Requests

- Fork the repository and create your branch from `main`.
- If you've added code that should be tested, add tests.
- If you've changed APIs, update the documentation.
- Ensure the test suite passes (`yarn test`).
- Make sure your code lints (`yarn lint`).
- Issue that pull request!

## Development Setup

1.  Fork the repo and create your branch from `main`.
2.  Install dependencies: `yarn install`
3.  Create a `.env.local` file based on `.env.example` (if it exists) and fill in necessary environment variables.
4.  Start the development server: `yarn dev`

## Coding Conventions

- Follow the existing code style (use Prettier/ESLint configuration provided).
- Write clear and concise comments for complex logic.
- Ensure your code is well-tested.

## User State Management (Redux vs `userService.nonUICurrentUser`)

Pulse maintains user information in **one source of truth — the Redux store**.  Two convenience layers sit on top of that store:

1. **`useUser()` hook**  
   • Returns a `User | null` pulled from `state.user.currentUser`.  
   • **Always use this hook inside React components** (screens, views, child components, etc.).  This keeps components declarative and automatically re‑renders them when the user object changes.

2. **`userService.nonUICurrentUser`**  
   • A *getter* that simply returns the same object stored in Redux.  
   • A *setter* that dispatches `setUser(...)` behind the scenes, keeping Redux in sync.  
   • Use this in **non‑UI contexts** (utility services, Firebase callbacks, background jobs) where React hooks aren't available.

### Typical Flow

```
// 1. Update Firestore
await userService.updateUser(userId, updatedUser);

// 2. Sync Redux (and therefore the UI)
userService.nonUICurrentUser = updatedUser;

// 3. Consume in UI
const currentUser = useUser();
```

### Rules of Thumb

| Where you are | Read from | Write with |
|---------------|-----------|------------|
| React component | `useUser()` | *Never write here — let services handle it* |
| Service / util | `userService.nonUICurrentUser` | `userService.nonUICurrentUser = ...` |

Avoid accessing `userService.nonUICurrentUser` directly inside React components; use the hook instead.  Likewise, do **not** import Redux actions (`setUser`) directly—always go through the service so the coupling stays in one place.

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Questions?

If you have any questions, feel free to reach out or open an issue. 