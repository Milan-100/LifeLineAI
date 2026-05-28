export interface SOSContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  isPriority: boolean;
}

export interface MedicalRecord {
  id: string;
  title: string;
  type: 'Prescription' | 'Lab Report' | 'Vaccination' | 'Doctor Note';
  date: string;
  fileUrl?: string; // In a real app, this would be a Firebase Storage URL
  fileName: string;
  isPrivate: boolean;
  base64Data?: string; // Simulated storage for demo
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  problemType: string;
  medicalHistory: string;
  allergies: string;
  bloodGroup: string;
  idType: string;
  idNumber: string;
  medicalRecords?: MedicalRecord[];
  ownerUid?: string;
}

export interface Hospital {
  id: string;
  name: string;
  distance: string;
  bedAvailability: number;
  icuAvailability: number;
  specialization: string[];
  contact: string;
  address: string;
  rating: number;
  lat: number;
  lng: number;
  mapsUrl?: string;
  images?: string[];
}

export interface Ambulance {
  id: string;
  type: 'Basic' | 'Advanced' | 'ICU';
  eta: string;
  distance: string;
  price: string;
}

export type Screen = 
  | 'welcome' 
  | 'auth' 
  | 'dashboard' 
  | 'patients' 
  | 'emergency' 
  | 'ambulance' 
  | 'chatbot' 
  | 'hospitals' 
  | 'admin'
  | 'sos'
  | 'learnMore';
