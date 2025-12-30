export interface User {
  id: string;
  phoneNumber: string;
  name?: string;
  photoUrl?: string;
  createdAt: Date;
}

export interface Bill {
  id: string;
  userId: string;
  billNumber: string;
  amount: number;
  date: Date;
  from?: string;
  to?: string;
  imageUrl?: string;
  createdAt: Date;
  extractedText?: string;
  co2Saved?: string;
}

export interface ExpenseStats {
  totalExpenses: number;
  totalDistance: number;
  averageExpense: number;
  billCount: number;
  totalCo2Saved: number;
}

export interface OTPVerification {
  phoneNumber: string;
  otp: string;
  verified: boolean;
}
