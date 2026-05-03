import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

// Mock OTP authentication service with Firestore integration
export class AuthService {
  private static readonly STORAGE_KEY = 'user_data';
  private static readonly USERS_COLLECTION = 'users';

  // Mock OTP - In production, this should use Firebase Auth
  static async sendOTP(phoneNumber: string): Promise<boolean> {
    // Simulate sending OTP
    console.log(`Mock OTP sent to ${phoneNumber}: 123456`);
    return true;
  }

  static async verifyOTP(phoneNumber: string, otp: string, name?: string, photoUrl?: string): Promise<User | null> {
    // Mock verification - accept "123456" as valid OTP
    if (otp !== '123456') {
      return null;
    }

    const userId = phoneNumber.replace(/[^0-9]/g, '');

    // 1. Build user object immediately — don't wait for Firestore
    const user: User = {
      id: userId,
      phoneNumber,
      name: name || '',
      photoUrl: photoUrl || '',
      createdAt: new Date(),
    };

    // 2. Save to AsyncStorage immediately so navigation works right away
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
      console.log('✅ User saved locally:', phoneNumber);
    } catch (storageError) {
      console.error('❌ AsyncStorage error:', storageError);
      // Even if storage fails, return the user so navigation proceeds
    }

    // 3. Sync to Firestore in background — non-blocking, never delays login
    AuthService.syncUserToFirestore(userId, phoneNumber, name, photoUrl).catch((e) =>
      console.warn('⚠️ Firestore sync failed (non-critical):', e)
    );

    return user;
  }

  // Background Firestore sync — never blocks the login flow
  private static async syncUserToFirestore(
    userId: string,
    phoneNumber: string,
    name?: string,
    photoUrl?: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, AuthService.USERS_COLLECTION),
        where('phoneNumber', '==', phoneNumber)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // New user — create in Firestore
        await setDoc(doc(db, AuthService.USERS_COLLECTION, userId), {
          phoneNumber,
          name: name || '',
          photoUrl: photoUrl || '',
          createdAt: new Date(),
        });
        console.log('✅ New user synced to Firestore:', phoneNumber);
      } else {
        // Existing user — refresh local cache with Firestore data
        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();
        const firestoreUser: User = {
          id: userDoc.id,
          phoneNumber: userData.phoneNumber,
          name: userData.name,
          photoUrl: userData.photoUrl,
          createdAt: userData.createdAt?.toDate?.() ?? new Date(),
        };
        await AsyncStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(firestoreUser));
        console.log('✅ Existing user data refreshed from Firestore:', phoneNumber);
      }
    } catch (error) {
      console.warn('⚠️ Background Firestore sync failed (non-critical):', error);
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(AuthService.STORAGE_KEY);
      if (!userData) return null;

      const user = JSON.parse(userData);

      // Ensure createdAt is a Date object
      if (user.createdAt && typeof user.createdAt === 'string') {
        user.createdAt = new Date(user.createdAt);
      }

      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async logout(): Promise<void> {
    await AsyncStorage.removeItem(AuthService.STORAGE_KEY);
    console.log('✅ User logged out');
  }

  static async updateProfile(userId: string, data: { name?: string; photoUrl?: string }): Promise<void> {
    try {
      // Update in Firestore
      const userRef = doc(db, AuthService.USERS_COLLECTION, userId);
      await setDoc(userRef, data, { merge: true });

      // Update in AsyncStorage
      const currentUser = await AuthService.getCurrentUser();
      if (currentUser) {
        const updatedUser = { ...currentUser, ...data };
        await AsyncStorage.setItem(AuthService.STORAGE_KEY, JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }
}
