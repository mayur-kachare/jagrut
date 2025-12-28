# Gemini Agent Instructions - Jagrut Project

This document provides instructions for the Gemini agent to assist in the development of the Jagrut project.

## 1. Project Overview

**Jagrut** is a React Native Expo mobile application designed for bill management and expense tracking. Users can capture bills using their device's camera, extract information via OCR, and monitor their expenses through statistical analysis.

## 2. Tech Stack

-   **Frontend**: React Native with Expo (TypeScript)
-   **State Management**: React Context API (`AuthContext`)
-   **Navigation**: React Navigation (Native Stack)
-   **Backend/DB**: Firebase (Firestore, Storage, Authentication)
-   **Image Handling**: `expo-camera`, `expo-image-picker`, `expo-image-manipulator`
-   **On-Device OCR**: `react-native-executorch`
-   **Package Manager**: pnpm

## 3. Development Workflow

### Setup and Running the App

Use the following `run_shell_command` calls to manage the project:

-   **Install dependencies**:
    ```bash
    pnpm install
    ```
-   **Start the development server**:
    ```bash
    pnpm start
    ```
-   **Run on Android**:
    ```bash
    pnpm android
    ```
-   **Run on iOS**:
    ```bash
    pnpm ios
    ```

### User Flow

1.  **Authentication**: Users log in using a phone number and OTP. The current implementation is a mock (`OTP: 123456`).
2.  **Capture Bill**: Users can take a photo of a bill or select one from their gallery.
3.  **OCR Processing**: On-device OCR extracts key information like bill number, amount, date, and locations.
4.  **Data Storage**: The captured image is compressed, uploaded to Firebase Storage, and the extracted data is saved to Firestore.
5.  **Analytics**: The app provides insights into total expenses, distance traveled, and a history of bills.

## 4. File Organization

The project follows a standard React Native structure:

```
src/
├── components/     # Reusable UI components (e.g., ErrorBoundary)
├── context/        # React Context for global state (AuthContext)
├── hooks/          # Custom React hooks
├── navigation/     # Navigation setup (AppNavigator)
├── screens/        # Top-level screen components
├── services/       # External service integrations (Firebase, Auth, OCR)
├── types/          # TypeScript type definitions
└── utils/          # Utility functions (e.g., imageCompressor)
```

## 5. Key Files & Purpose

-   `App.tsx`: The root component that initializes the `AuthProvider` and `AppNavigator`.
-   `package.json`: Defines scripts, dependencies, and project metadata.
-   `src/navigation/AppNavigator.tsx`: Configures the app's navigation stack based on authentication state.
-   `src/context/AuthContext.tsx`: Manages user authentication state globally.
-   `src/services/auth.ts`: Handles authentication logic. **Currently a mock service.**
-   `src/services/ocr.ts`: Manages OCR processing. Uses on-device model with a mock fallback.
-   `src/services/firestore.ts`: Handles all interactions with the Firestore database (saving and retrieving bills).
-   `src/services/firebase.ts`: Firebase configuration. **Requires credentials to be set up.**
-   `src/types/index.ts`: Contains all TypeScript interfaces for the application.

## 6. Code Conventions

-   **Typing**: The project uses TypeScript with the `strict` flag enabled. All types should be defined in `src/types/index.ts`.
-   **Components**: Use functional components with hooks.
-   **Styling**: Use React Native's `StyleSheet` API for all component styling.
-   **State Management**: Use React Context for global state and `useState` for local component state.
-   **Error Handling**: Implement `try-catch` blocks for asynchronous operations and use the `ErrorBoundary` component to catch rendering errors.
-   **Asynchronous Code**: Use `async/await` syntax for all promises.

## 7. Core Workflows for Gemini Agent

### Adding a New Feature (e.g., a "Settings" screen)

1.  **Analyze Request**: Understand the required functionality and UI.
2.  **Update Types**: If new data structures are needed, use `replace` to add a new interface to `src/types/index.ts`.
3.  **Create Screen**: Use `write_file` to create a new screen component at `src/screens/SettingsScreen.tsx`.
4.  **Add Navigation**:
    -   Use `read_file` on `src/navigation/AppNavigator.tsx` to get its content.
    -   Use `replace` to add `"Settings"` to the `RootStackParamList` type.
    -   Use `replace` again to add a new `Stack.Screen` for the `SettingsScreen` within the authenticated user section.
5.  **Implement Logic**: If the feature requires backend interaction, add methods to the appropriate file in `src/services/` using `replace`.

### Replacing Mock OCR with a Real Service

1.  **Identify Target**: The file to modify is `src/services/ocr.ts`.
2.  **Analyze New Service**: Understand the API and data format of the new OCR service (e.g., Google ML Kit, Tesseract.js).
3.  **Modify `extractTextFromImage`**:
    -   Read `src/services/ocr.ts`.
    -   Use `replace` to comment out or remove the `react-native-executorch` logic inside the `extractTextFromImage` function.
    -   Use `replace` to implement the new API call to the real OCR service. Ensure the new implementation returns an object matching the `Partial<Bill>` type.

### Implementing Real Firebase Authentication

1.  **Identify Target**: The file to modify is `src/services/auth.ts`.
2.  **Update Imports**: Use `replace` to import `signInWithPhoneNumber` and other necessary functions from `firebase/auth`.
3.  **Modify `sendOTP`**:
    -   Use `replace` to change the `sendOTP` method to call Firebase's `signInWithPhoneNumber` function. This will involve setting up a `RecaptchaVerifier`.
4.  **Modify `verifyOTP`**:
    -   Use `replace` to change the `verifyOTP` method. Instead of checking for a mock OTP, it should use the confirmation result from `sendOTP` to verify the code.
5.  **Remove Mock Logic**: Safely remove the mock `123456` OTP check.

## 8. Data Model (Firestore)

The primary data collection is `bills`. Each document in this collection follows the `Bill` interface:

```typescript
interface Bill {
  id: string;          // Document ID
  userId: string;        // ID of the user who owns the bill
  billNumber: string;
  amount: number;
  date: Date;
  from: string;          // Origin location
  to: string;            // Destination location
  imageUrl: string;      // URL of the bill image in Firebase Storage
  extractedText?: string;// Raw text from OCR
  createdAt: Date;       // Timestamp of when the record was created
}
```

## 9. Production Readiness Checklist

-   [ ] Replace mock OTP with Firebase Phone Auth.
-   [ ] Implement a robust, real OCR service.
-   [ ] Add comprehensive error tracking (e.g., Sentry, Bugsnag).
-   [ ] Implement actual distance calculation (e.g., using Google Maps API).
-   [ ] Add input validation and data sanitization on all user inputs.
-   [ ] Set up a CI/CD pipeline for automated builds and deployments.
-   [ ] Configure app signing for both iOS and Android release builds.
