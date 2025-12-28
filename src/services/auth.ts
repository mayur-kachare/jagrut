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
    if (otp === '123456') {
      try {
        // Check if user exists in Firestore
        const q = query(
          collection(db, this.USERS_COLLECTION),
          where('phoneNumber', '==', phoneNumber)
        );
        
        const querySnapshot = await getDocs(q);
        
        let user: User;
        
        if (!querySnapshot.empty) {
          // Existing user - retrieve their data
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          user = {
            id: userDoc.id,
            phoneNumber: userData.phoneNumber,
            name: userData.name,
            photoUrl: userData.photoUrl,
            createdAt: userData.createdAt.toDate(),
          };
          console.log('✅ Existing user logged in:', phoneNumber);
        } else {
          // New user - create in Firestore
          const userId = phoneNumber.replace(/[^0-9]/g, ''); // Use phone number as ID
          const newUser = {
            phoneNumber,
            name: name || '',
            photoUrl: photoUrl || '',
            createdAt: new Date(),
          };
          
          await setDoc(doc(db, this.USERS_COLLECTION, userId), newUser);
          
          user = {
            id: userId,
            ...newUser,
          };
          console.log('✅ New user created:', phoneNumber);
        }
        
        // Save to AsyncStorage for offline access
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
        return user;
      } catch (error) {
        console.error('❌ Error during authentication:', error);
        
        // Fallback to local-only user if Firestore fails
        const fallbackUser: User = {
          id: phoneNumber.replace(/[^0-9]/g, ''),
          phoneNumber,
          createdAt: new Date(),
        };
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(fallbackUser));
        return fallbackUser;
      }
    }
    return null;
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(this.STORAGE_KEY);
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
    await AsyncStorage.removeItem(this.STORAGE_KEY);
    console.log('✅ User logged out');
  }

  static async updateProfile(userId: string, data: { name?: string; photoUrl?: string }): Promise<void> {
    try {
      // Update in Firestore
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      await setDoc(userRef, data, { merge: true });

      // Update in AsyncStorage
      const currentUser = await this.getCurrentUser();
      if (currentUser) {
        const updatedUser = { ...currentUser, ...data };
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }
}
