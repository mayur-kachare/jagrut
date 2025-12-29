import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Bill, ExpenseStats } from '../types';

export class FirestoreService {
  private static readonly BILLS_COLLECTION = 'bills';

  // Check if bill exists
  static async checkBillExists(billNumber: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, this.BILLS_COLLECTION),
        where('billNumber', '==', billNumber)
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking bill existence:', error);
      return false;
    }
  }

  // Save bill to Firestore
  static async saveBill(bill: Omit<Bill, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.BILLS_COLLECTION), {
        ...bill,
        createdAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving bill:', error);
      throw error;
    }
  }

  // Get user bills
  static async getUserBills(userId: string): Promise<Bill[]> {
    try {
      const q = query(
        collection(db, this.BILLS_COLLECTION),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      const bills: Bill[] = [];
      
      querySnapshot.forEach((doc) => {
        bills.push({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date.toDate(),
          createdAt: doc.data().createdAt.toDate(),
        } as Bill);
      });
      
      // Sort by createdAt in JavaScript instead of Firestore
      bills.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      return bills;
    } catch (error) {
      console.error('Error getting user bills:', error);
      throw error;
    }
  }

  // Calculate expense statistics
  static async getExpenseStats(userId: string): Promise<ExpenseStats> {
    const bills = await this.getUserBills(userId);
    
    const totalExpenses = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const billCount = bills.length;
    const averageExpense = billCount > 0 ? totalExpenses / billCount : 0;
    
    // Mock distance calculation - implement based on from/to locations
    const totalDistance = billCount * 50; // Mock: 50km per bill
    
    return {
      totalExpenses,
      totalDistance,
      averageExpense,
      billCount,
    };
  }
}
