/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Phone, 
  User, 
  MapPin, 
  MessageSquare, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft, 
  Search, 
  Activity, 
  Shield, 
  Clock, 
  Menu,
  X,
  Send,
  Mic,
  Settings,
  LogOut,
  Hospital as HospitalIcon,
  Ambulance as AmbulanceIcon,
  CheckCircle2,
  Info,
  Edit2,
  Check,
  FileText,
  Upload,
  Eye,
  EyeOff,
  Download,
  Trash2,
  Share2,
  Lock,
  Unlock,
  FileUp
} from 'lucide-react';
import { Screen, Patient, Hospital, Ambulance, MedicalRecord, SOSContact } from './types';
import { MOCK_HOSPITALS, AMBULANCE_TYPES } from './constants';
import { analyzeSymptoms, getChatResponse } from './services/geminiService';
import { RealTimeMap } from './components/RealTimeMap';

import { db, auth } from './firebase';
import { collection, addDoc, getDocs, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { signInAnonymously, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

class ErrorBoundary extends React.Component<any, any> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
          <div className="max-w-md w-full p-8 bg-white dark:bg-slate-900 rounded-[32px] shadow-xl border border-slate-100 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-red-600 w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h2>
            <p className="text-slate-500 dark:text-slate-400 mb-8">
              We encountered an unexpected error. Please try refreshing the application.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 dark:shadow-none"
            >
              Refresh App
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [user, setUser] = useState<{ name: string; phone: string; uid?: string } | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [sosContacts, setSosContacts] = useState<SOSContact[]>([]);
  
  // Sync patients with Firestore
  useEffect(() => {
    if (user?.uid) {
      const q = query(collection(db, 'patients'), where('ownerUid', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const patientsData: Patient[] = [];
        snapshot.forEach((doc) => {
          patientsData.push({ ...doc.data(), id: doc.id } as Patient);
        });
        setPatients(patientsData);
        
        // Keep selected patient in sync with updated list
        setSelectedPatient(prev => {
          if (!prev) return null;
          const updated = patientsData.find(p => p.id === prev.id);
          return updated || null;
        });
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'patients');
      });
      return () => unsubscribe();
    }
  }, [user?.uid]);

  // Sync SOS Contacts with Firestore
  useEffect(() => {
    if (user?.uid) {
      const q = query(collection(db, 'sosContacts'), where('ownerUid', '==', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const contactsData: SOSContact[] = [];
        snapshot.forEach((doc) => {
          contactsData.push({ ...doc.data(), id: doc.id } as SOSContact);
        });
        setSosContacts(contactsData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'sosContacts');
      });
      return () => unsubscribe();
    }
  }, [user?.uid]);

  const saveSOSContact = async (contact: Partial<SOSContact>) => {
    if (!user?.uid) return;
    try {
      const contactData = { ...contact, ownerUid: user.uid };
      if (contact.id) {
        const docRef = doc(db, 'sosContacts', contact.id);
        const { id, ...updateData } = contactData;
        await updateDoc(docRef, updateData);
      } else {
        await addDoc(collection(db, 'sosContacts'), contactData);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sosContacts');
      throw error;
    }
  };

  const deleteSOSContact = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sosContacts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'sosContacts');
    }
  };

  const savePatient = async (patient: Patient) => {
    if (!user?.uid) {
      console.warn("Attempted to save patient without user context");
      return;
    }
    
    try {
      // Ensure all required fields are present and valid
      const patientData = { 
        ...patient, 
        ownerUid: user.uid,
        firstName: patient.firstName?.trim() || '',
        lastName: patient.lastName?.trim() || '',
        medicalRecords: patient.medicalRecords || [],
        updatedAt: new Date().toISOString()
      };
      
      console.log("[savePatient] Payload:", patientData);
      
      if (patient.id && patient.id !== '' && patient.id !== 'p1') {
        console.log("[savePatient] Updating patient:", patient.id);
        const docRef = doc(db, 'patients', patient.id);
        const { id, ...updateData } = patientData;
        await updateDoc(docRef, updateData);
      } else {
        console.log("[savePatient] Creating new patient");
        const { id, ...rest } = patientData;
        const result = await addDoc(collection(db, 'patients'), rest);
        console.log("[savePatient] Success! ID:", result.id);
      }
    } catch (error: any) {
      console.error("[savePatient] FATAL ERROR:", error);
      
      // Provide more specific feedback if possible
      if (error.code === 'permission-denied') {
        console.error("Security Rules rejected the write. Check ownerUid and required fields.");
      }
      
      handleFirestoreError(error, OperationType.WRITE, 'patients');
      throw error;
    }
  };
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientsModal, setShowPatientsModal] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [isAddingSOSContact, setIsAddingSOSContact] = useState(false);
  const [newSOSContact, setNewSOSContact] = useState({
    name: '',
    phone: '',
    relation: '',
    isPriority: false
  });
  const [newRecordForm, setNewRecordForm] = useState<{
    title: string;
    type: 'Prescription' | 'Lab Report' | 'Vaccination' | 'Doctor Note';
    isPrivate: boolean;
    fileName?: string;
    base64Data?: string;
  }>({
    title: '',
    type: 'Prescription',
    isPrivate: false
  });
  const [previewRecord, setPreviewRecord] = useState<MedicalRecord | null>(null);
  const [newPatientForm, setNewPatientForm] = useState<{
    firstName: string;
    lastName: string;
    dob: string;
    gender: string;
    problemType: string;
    otherProblem: string;
    medicalHistory: string;
    allergies: string;
    bloodGroup: string;
    idType: string;
    idNumber: string;
    medicalRecords: MedicalRecord[];
  }>({
    firstName: '',
    lastName: '',
    dob: '',
    gender: 'Male',
    problemType: 'None',
    otherProblem: '',
    medicalHistory: '',
    allergies: '',
    bloodGroup: 'O+',
    idType: 'Aadhaar',
    idNumber: '',
    medicalRecords: [],
  });
  const [isCreatingPatient, setIsCreatingPatient] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; text: string; type: 'info' | 'alert' }[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Auth State
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const testConnection = async () => {
      try {
        const { getDocFromServer, doc } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  };

  const formatDate = () => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(currentTime);
  };
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '']);
  const [isOtpError, setIsOtpError] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const otpRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [isOtpSent, setIsOtpSent] = useState(false);

  // Emergency State
  const [symptoms, setSymptoms] = useState('');
  const [analysis, setAnalysis] = useState<{ riskLevel: string; firstAidSteps: string[]; recommendation: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Hospital/Ambulance State
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [bookingAmbulance, setBookingAmbulance] = useState<Ambulance | null>(null);
  const [showVitalsPrompt, setShowVitalsPrompt] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [realTimeAmbulanceDistances, setRealTimeAmbulanceDistances] = useState<{ id: string; distance: string; duration: string }[]>([]);
  const [realTimeHospitalDistances, setRealTimeHospitalDistances] = useState<{ id: string; distance: string; duration: string }[]>([]);

  const defaultLocation = { lat: 28.5672, lng: 77.2100 }; // AIIMS Delhi as default

  useEffect(() => {
    let watchId: number;
    if (currentScreen === 'ambulance' || currentScreen === 'emergency' || currentScreen === 'hospitals') {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => {
            console.error('Geolocation error:', error);
          },
          { enableHighAccuracy: true }
        );
      }
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [currentScreen]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const addNotification = (text: string, type: 'info' | 'alert' = 'info') => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if (isOtpSent && otpRefs[0].current) {
      otpRefs[0].current.focus();
    }
  }, [isOtpSent]);

  const handleLogin = () => {
    if (phoneInput.length >= 10) {
      setIsOtpSent(true);
      setAuthError(null);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      setUser({ 
        name: result.user.displayName || 'User', 
        phone: result.user.phoneNumber || '', 
        uid: result.user.uid 
      });
      setCurrentScreen('dashboard');
      addNotification(`Welcome ${result.user.displayName || 'User'}!`);
    } catch (error: any) {
      console.error("Google Auth error:", error);
      if (error.code === 'auth/cancelled-popup-request' || error.message?.includes('cancelled-popup-request') || error.code === 'auth/popup-closed-by-user') {
        addNotification('Google Sign-In popup was closed or cancelled.', 'alert');
      } else if (error.code === 'auth/popup-blocked' || error.message?.includes('popup-blocked')) {
        addNotification('Google sign-in popup was blocked by your browser. Please allow popups or use "Continue as Guest".', 'alert');
      } else {
        addNotification('Google Sign-In failed. Please try "Continue as Guest" or allow popups.', 'alert');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyOtp = (currentOtp?: string) => {
    if (isLoggingIn) return;
    const otp = currentOtp || otpInput.join('');
    if (otp.length === 4) {
      if (otp === '0000') {
        setIsLoggingIn(true);
        const fallbackId = 'guest_' + Math.random().toString(36).substr(2, 9);
        signInAnonymously(auth).then((result) => {
          setUser({ name: 'User', phone: phoneInput, uid: result.user.uid });
          setCurrentScreen('dashboard');
          addNotification('Welcome Guest!');
        }).catch(err => {
          console.error("Auth error:", err);
          // Fallback for demo if anonymous login is not enabled in Firebase
          setUser({ name: 'User', phone: phoneInput, uid: fallbackId });
          setCurrentScreen('dashboard');
          addNotification('Welcome! (Demo Mode)');
          
          if (err.code === 'auth/admin-restricted-operation') {
            console.warn('Anonymous Login is disabled in Firebase Console.');
          }
        }).finally(() => {
          setIsLoggingIn(false);
        });
        setIsOtpError(false);
        setAuthError(null);
      } else {
        const errorMsg = 'Invalid OTP. Please use 0000 for demo.';
        addNotification(errorMsg, 'alert');
        setAuthError(errorMsg);
        setIsOtpError(true);
        setTimeout(() => setIsOtpError(false), 500); // Reset shake
        setOtpInput(['', '', '', '']);
        otpRefs[0].current?.focus();
      }
    }
  };

  const handleEmergencyAnalysis = async () => {
    if (!symptoms) return;
    setIsAnalyzing(true);
    const result = await analyzeSymptoms(symptoms);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput) return;
    const userMsg = { role: 'user' as const, text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    
    const aiResponse = await getChatResponse(chatInput, []);
    setChatMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
  };

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-slate-950">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-8"
      >
        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-200 dark:shadow-none">
          <Shield className="text-white w-12 h-12" />
        </div>
      </motion.div>
      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-2"
      >
        LifeLine AI
      </motion.h1>
      <motion.p 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-slate-500 dark:text-slate-400 text-center mb-12"
      >
        Smart Emergency Healthcare Assistant
      </motion.p>
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="w-full space-y-4"
      >
        <button 
          onClick={() => setCurrentScreen('auth')}
          className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-colors"
        >
          Get Started
        </button>
        <button 
          onClick={() => setCurrentScreen('learnMore')}
          className="w-full py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Learn More
        </button>
      </motion.div>
    </div>
  );

  const renderLearnMore = () => (
    <div className="flex flex-col min-h-screen p-6 bg-white dark:bg-slate-950">
      <button onClick={() => setCurrentScreen('welcome')} className="mb-8 p-2 -ml-2">
        <ArrowLeft className="text-slate-900 dark:text-white" />
      </button>
      <div className="space-y-6">
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[32px] border border-blue-100 dark:border-blue-800/50">
          <h2 className="text-xl font-bold text-blue-900 dark:text-blue-100 mb-4">About LifeLine AI</h2>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-4">
           Lifeline AI, developed by Engineering students of Dronacharya College of Engineering - AIML 6th semester— Milan Tyagi, Swarnim Arya, and Aayush Arya
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            An AI-powered emergency healthcare response system for rapid medical assistance, hospital tracking, and ambulance booking.
          </p>
        </div>
        
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white">Our Mission</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            To provide immediate, intelligent medical assistance during critical moments, bridging the gap between patients and emergency services.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Shield className="w-6 h-6 text-blue-600 mb-2" />
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Secure</h4>
            <p className="text-[10px] text-slate-500">Your data is encrypted and safe.</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Activity className="w-6 h-6 text-green-600 mb-2" />
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Fast</h4>
            <p className="text-[10px] text-slate-500">Real-time tracking and response.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAuth = () => (
    <div className="flex flex-col min-h-screen p-6 bg-white dark:bg-slate-950">
      <button onClick={() => setCurrentScreen('welcome')} className="mb-8 p-2 -ml-2">
        <ArrowLeft className="text-slate-900 dark:text-white" />
      </button>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
        {isOtpSent ? 'Verify OTP' : 'Welcome Back'}
      </h2>
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        {isOtpSent ? `Enter the code sent to ${phoneInput}` : 'Enter your mobile number to continue'}
      </p>

      {!isOtpSent ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Mobile Number</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">+91</span>
              <input 
                type="tel" 
                value={phoneInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && phoneInput.length >= 10) {
                    handleLogin();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setPhoneInput(val);
                }}
                placeholder="98765 12345"
                className={`w-full pl-14 pr-4 py-4 bg-slate-50 dark:bg-slate-900 border rounded-2xl focus:ring-2 outline-none transition-all dark:text-white ${
                  phoneInput.length > 0 && phoneInput.length < 10 
                  ? 'border-red-500 focus:ring-red-500' 
                  : 'border-slate-200 dark:border-slate-800 focus:ring-blue-500'
                }`}
              />
            </div>
          </div>
          <button 
            onClick={handleLogin}
            disabled={phoneInput.length < 10}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
          >
            Send OTP
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full py-4 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-3 mb-4 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
          </button>

          <button 
            disabled={isLoggingIn}
            onClick={() => {
              if (isLoggingIn) return;
              setIsLoggingIn(true);
              const fallbackId = 'guest_' + Math.random().toString(36).substr(2, 9);
              signInAnonymously(auth).then((result) => {
                setUser({ name: 'Guest', phone: phoneInput || '', uid: result.user.uid });
                setCurrentScreen('dashboard');
                addNotification('Welcome Guest!');
              }).catch(err => {
                console.error("Auth error:", err);
                // Fallback for demo
                setUser({ name: 'Guest', phone: phoneInput || '', uid: fallbackId });
                setCurrentScreen('dashboard');
                addNotification('Welcome Guest! (Demo Mode)');
              }).finally(() => {
                setIsLoggingIn(false);
              });
            }}
            className="w-full py-4 text-slate-500 font-medium text-sm hover:text-blue-600 transition-colors disabled:opacity-50"
          >
            {isLoggingIn ? 'Please wait...' : 'Continue as Guest'}
          </button>
        </div>
      ) : (
        <div className="space-y-6 text-left">
          <motion.div 
            animate={isOtpError ? { x: [-10, 10, -10, 10, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="flex justify-between gap-4"
          >
            {otpInput.map((digit, i) => (
              <input 
                key={i}
                ref={otpRefs[i]}
                type="text" 
                maxLength={1}
                value={digit}
                className={`w-full h-16 text-center text-2xl font-bold bg-slate-50 dark:bg-slate-900 border rounded-2xl focus:ring-2 outline-none transition-all dark:text-white ${
                  isOtpError ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-slate-800 focus:ring-blue-500'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digit && i > 0) {
                    otpRefs[i - 1].current?.focus();
                  }
                  if (e.key === 'Enter' && otpInput.every(d => d !== '')) {
                    handleVerifyOtp();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val || e.target.value === '') {
                    const newOtp = [...otpInput];
                    const lastDigit = val.slice(-1);
                    newOtp[i] = lastDigit;
                    setOtpInput(newOtp);
                    if (lastDigit && i < 3) {
                      otpRefs[i + 1].current?.focus();
                    } else if (lastDigit && i === 3) {
                      // Auto-verify when 4th digit is entered
                      handleVerifyOtp(newOtp.join(''));
                    }
                  } else {
                    addNotification('Please enter numbers only', 'alert');
                    setIsOtpError(true);
                    setTimeout(() => setIsOtpError(false), 500);
                  }
                }}
              />
            ))}
          </motion.div>
          {authError ? (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-xs font-bold text-red-600 dark:text-red-400">{authError}</p>
            </motion.div>
          ) : (
            <p className="text-center text-xs text-slate-400 font-medium">Hint: Use <span className="text-blue-600">0000</span> for demo</p>
          )}
          <button 
            onClick={() => handleVerifyOtp()}
            disabled={isLoggingIn}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoggingIn ? 'Verifying...' : 'Verify & Login'}
          </button>
          <p className="text-center text-slate-500 dark:text-slate-400">
            Didn't receive code? <button className="text-blue-600 font-semibold">Resend</button>
          </p>
        </div>
      )}
    </div>
  );

  const triggerSOSAlert = () => {
    if (sosContacts.length === 0) {
      addNotification('No SOS contacts found. Please add them in your profile.', 'alert');
      setShowSOSModal(true);
      return;
    }
    
    // Simulate sending alerts
    const priorityContacts = sosContacts.filter(c => c.isPriority);
    const targetContacts = priorityContacts.length > 0 ? priorityContacts : sosContacts;
    
    addNotification(`Sending emergency alert to ${targetContacts.length} contacts...`);
    
    // Simulate alert status
    setTimeout(() => {
      addNotification(`Alert sent to: ${targetContacts.map(c => c.name).join(', ')}`, 'info');
    }, 1500);
  };

  const renderDashboard = () => (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-b-[32px] shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <User className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{getGreeting()},</p>
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input 
                      type="text"
                      value={tempName}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                        setTempName(val);
                      }}
                      className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none dark:text-white w-32"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (tempName.trim()) {
                            setUser(prev => prev ? { ...prev, name: tempName.trim() } : null);
                            setIsEditingName(false);
                            addNotification('Name updated successfully');
                          }
                        }
                      }}
                    />
                    <button 
                      onClick={() => {
                        if (tempName.trim()) {
                          setUser(prev => prev ? { ...prev, name: tempName.trim() } : null);
                          setIsEditingName(false);
                          addNotification('Name updated successfully');
                        }
                      }}
                      className="p-1 text-green-600"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">Hello, {user?.name}</h3>
                    <button 
                      onClick={() => {
                        setTempName(user?.name || '');
                        setIsEditingName(true);
                      }}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium whitespace-nowrap">
                  {formatDate()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSOSModal(true)}
              className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 transition-colors"
            >
              <AlertCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl"
            >
              <LogOut className="w-5 h-5 text-red-500" />
            </button>
          </div>
        </div>

        {/* SOS Button */}
        <button 
          onClick={() => setCurrentScreen('emergency')}
          className="w-full p-6 bg-red-500 rounded-3xl flex items-center justify-between shadow-xl shadow-red-200 dark:shadow-none group active:scale-95 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center animate-pulse">
              <AlertCircle className="text-white w-8 h-8" />
            </div>
            <div className="text-left">
              <h4 className="text-white font-bold text-lg">Emergency Help</h4>
              <p className="text-white/80 text-sm">Immediate medical assistance</p>
            </div>
          </div>
          <ChevronRight className="text-white w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Your Patients */}
      <div className="px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 dark:text-white">Your Patients</h4>
            {patients.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-full">
                {patients.length} {patients.length === 1 ? 'Patient' : 'Patients'}
              </span>
            )}
          </div>
          <button 
            onClick={() => setShowPatientsModal(true)}
            className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full hover:bg-blue-600 hover:text-white transition-all"
          >
            See All
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-6 px-6">
          {/* Add Patient Button Card */}
          <button 
            onClick={() => setIsAddingPatient(true)}
            className="flex-shrink-0 w-32 h-40 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3 transition-all active:scale-95"
          >
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
              <Plus className="text-blue-600 w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase">Add New</p>
          </button>

          {/* Patient Cards */}
          {patients.map((p, idx) => (
            <div 
              key={`${p.id}-${idx}`}
              className="flex-shrink-0 w-40 h-40 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 flex flex-col justify-between hover:border-blue-500 transition-all cursor-pointer"
              onClick={() => setSelectedPatient(p)}
            >
              <div className="flex justify-between items-start">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                  <User className="text-blue-600 dark:text-blue-400 w-5 h-5" />
                </div>
                <div className="px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <span className="text-[10px] font-bold text-red-500 uppercase">{p.bloodGroup}</span>
                </div>
              </div>
              <div className="mt-2 text-left">
                <h5 className="font-bold text-slate-900 dark:text-white text-sm truncate">{p.firstName} {p.lastName}</h5>
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{p.problemType}</p>
                  {p.medicalRecords && p.medicalRecords.length > 0 && (
                    <>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        {p.medicalRecords.length} {p.medicalRecords.length === 1 ? 'doc' : 'docs'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="w-full mt-2 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-700 dark:text-slate-200 text-center">
                View Profile
              </div>
            </div>
          ))}
          
          {patients.length === 0 && (
            <div className="flex-shrink-0 w-48 flex items-center pl-2">
              <p className="text-xs text-slate-400 italic">No patient profiles added yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-6">
        <h4 className="font-bold text-slate-900 dark:text-white mb-4">Quick Services</h4>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => setShowRecordsModal(true)}
            className="p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-3"
          >
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <FileText className="text-purple-600 dark:text-purple-400 w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 dark:text-white text-sm">Records</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">View all files</p>
            </div>
          </button>
          <button 
            onClick={() => setCurrentScreen('hospitals')}
            className="p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-3"
          >
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <HospitalIcon className="text-green-600 dark:text-green-400 w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 dark:text-white text-sm">Hospitals</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Find availability</p>
            </div>
          </button>
          <button 
            onClick={() => setCurrentScreen('ambulance')}
            className="p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-3"
          >
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <AmbulanceIcon className="text-blue-600 dark:text-blue-400 w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 dark:text-white text-sm">Ambulance</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Book rapid ride</p>
            </div>
          </button>
          <button 
            onClick={() => setShowVitalsPrompt(true)}
            className="p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-3"
          >
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
              <Activity className="text-red-600 dark:text-red-400 w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 dark:text-white text-sm">Vitals</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sync health data</p>
            </div>
          </button>
          <button 
            onClick={() => setCurrentScreen('chatbot')}
            className="p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-3"
          >
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
              <MessageSquare className="text-orange-600 dark:text-orange-400 w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-900 dark:text-white text-sm">AI Chatbot</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">First aid advice</p>
            </div>
          </button>
        </div>
      </div>

      {/* Nearby Hospitals Preview */}
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-slate-900 dark:text-white">Nearby Hospitals</h4>
          <button 
            onClick={() => setCurrentScreen('hospitals')} 
            className="px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full hover:bg-blue-600 hover:text-white transition-all"
          >
            See All
          </button>
        </div>
        <div className="space-y-4">
          {MOCK_HOSPITALS.slice(0, 2).map(hospital => (
            <div key={hospital.id} className="p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
              <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden">
                <img src={`https://picsum.photos/seed/${hospital.id}/100/100`} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1">
                <h5 className="font-bold text-slate-900 dark:text-white text-sm">{hospital.name}</h5>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {hospital.distance} • {hospital.bedAvailability} beds available
                </p>
              </div>
              <ChevronRight className="text-slate-300 w-5 h-5" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-t border-slate-100 dark:border-slate-800 flex justify-around items-center">
        <button className="flex flex-col items-center gap-1 text-blue-600">
          <Activity className="w-6 h-6" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={() => setCurrentScreen('hospitals')} className="flex flex-col items-center gap-1 text-slate-400">
          <HospitalIcon className="w-6 h-6" />
          <span className="text-[10px] font-medium">Hospitals</span>
        </button>
        <button onClick={triggerSOSAlert} className="flex flex-col items-center gap-1 -mt-8">
          <div className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-200 dark:shadow-none border-4 border-white dark:border-slate-900">
            <AlertCircle className="text-white w-7 h-7" />
          </div>
          <span className="text-[10px] font-medium text-red-500 mt-1">SOS</span>
        </button>
        <button onClick={() => setShowPatientsModal(true)} className="flex flex-col items-center gap-1 text-slate-400">
          <User className="w-6 h-6" />
          <span className="text-[10px] font-medium">Profile</span>
        </button>
        <button onClick={() => setCurrentScreen('admin')} className="flex flex-col items-center gap-1 text-slate-400">
          <Shield className="w-6 h-6" />
          <span className="text-[10px] font-medium">Admin</span>
        </button>
      </div>
    </div>
  );

  const renderEmergency = () => (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950 p-6">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentScreen('dashboard')} className="p-2 bg-slate-100 dark:bg-slate-900 rounded-xl">
          <ArrowLeft className="text-slate-900 dark:text-white" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Emergency Help</h2>
          {userLocation ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Location Detected: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</p>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 italic">Locating your position...</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6 flex-1">
        <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-[32px] border border-blue-100 dark:border-blue-800/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Activity className="text-white w-6 h-6" />
            </div>
            <h3 className="font-bold text-blue-900 dark:text-blue-100">AI Symptom Checker</h3>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">Describe the symptoms or situation. Our AI will provide immediate advice.</p>
          <div className="relative">
            <textarea 
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. Severe chest pain, difficulty breathing..."
              className="w-full h-32 p-4 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white text-sm"
            />
            <button className="absolute bottom-3 right-3 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Mic className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <button 
            onClick={handleEmergencyAnalysis}
            disabled={isAnalyzing || !symptoms}
            className="w-full mt-4 py-4 bg-blue-600 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200 dark:shadow-none disabled:opacity-50"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Symptoms'}
          </button>
        </div>

        {analysis && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="space-y-4"
          >
            <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
              analysis.riskLevel === 'Critical' ? 'bg-red-50 border-red-100 text-red-700' :
              analysis.riskLevel === 'Medium' ? 'bg-orange-50 border-orange-100 text-orange-700' :
              'bg-green-50 border-green-100 text-green-700'
            }`}>
              <AlertCircle className="w-6 h-6" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Risk Level</p>
                <p className="font-bold text-lg">{analysis.riskLevel}</p>
              </div>
            </div>

            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" /> Immediate Steps
              </h4>
              <ul className="space-y-2">
                {analysis.firstAidSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 shrink-0" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </div>

      <div className="mt-8 space-y-4">
        <button 
          onClick={triggerSOSAlert}
          className="w-full py-5 bg-red-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-red-200 dark:shadow-none flex items-center justify-center gap-3"
        >
          <AlertCircle className="w-6 h-6" /> Notify SOS Contacts
        </button>
        <button 
          onClick={() => setCurrentScreen('ambulance')}
          className="w-full py-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-3 border border-red-100 dark:border-red-900/50"
        >
          <AmbulanceIcon className="w-6 h-6" /> Call Ambulance (112)
        </button>
        <button className="w-full py-4 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold flex items-center justify-center gap-3">
          <Phone className="w-5 h-5" /> Call Local Helpline (112)
        </button>
      </div>
    </div>
  );

  const renderAmbulance = () => (
    <div className="flex flex-col min-h-screen bg-white dark:bg-slate-950">
      {/* Real-time Map with Distance Matrix */}
      <div className="h-[40vh] bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
        <RealTimeMap 
          className="w-full h-full"
          destinations={AMBULANCE_TYPES.map((amb, idx) => ({
            id: amb.id,
            lat: (userLocation?.lat || defaultLocation.lat) + (idx + 1) * 0.01,
            lng: (userLocation?.lng || defaultLocation.lng) + (idx + 1) * 0.01,
            label: `${amb.type} Ambulance`
          }))}
          onDistancesCalculated={(results) => setRealTimeAmbulanceDistances(results)}
        />
        
        <button 
          onClick={() => setCurrentScreen('dashboard')}
          className="absolute top-6 left-6 p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl shadow-lg z-20"
        >
          <ArrowLeft className="text-slate-900 dark:text-white" />
        </button>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-950 rounded-t-[40px] -mt-10 relative z-10 p-6 shadow-2xl">
        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mb-6" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Select Ambulance Type</h3>
        
        <div className="space-y-4">
          {AMBULANCE_TYPES.map(amb => {
            const rtDist = realTimeAmbulanceDistances.find(d => d.id === amb.id);
            return (
              <button 
                key={amb.id}
                onClick={() => setBookingAmbulance(amb)}
                className={`w-full p-4 rounded-3xl border transition-all flex items-center gap-4 ${
                  bookingAmbulance?.id === amb.id 
                  ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20' 
                  : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                  amb.type === 'ICU' ? 'bg-red-100 text-red-600' :
                  amb.type === 'Advanced' ? 'bg-blue-100 text-blue-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  <AmbulanceIcon className="w-8 h-8" />
                </div>
                <div className="flex-1 text-left">
                  <h5 className="font-bold text-slate-900 dark:text-white">{amb.type} Support</h5>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {rtDist?.duration || amb.eta} • {rtDist?.distance || amb.distance}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 dark:text-white">{amb.price}</p>
                  <p className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Charges may apply</p>
                </div>
              </button>
            );
          })}
        </div>

        <button 
          disabled={!bookingAmbulance}
          onClick={() => {
            addNotification('Ambulance booked successfully!', 'info');
            setCurrentScreen('dashboard');
          }}
          className="w-full mt-8 py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 dark:shadow-none disabled:opacity-50"
        >
          Confirm Booking
        </button>
      </div>
    </div>
  );

  const renderChatbot = () => (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4">
        <button onClick={() => setCurrentScreen('dashboard')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <ArrowLeft className="text-slate-900 dark:text-white" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
            <MessageSquare className="text-orange-600 dark:text-orange-400 w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">LifeLine AI Assistant</h3>
            <p className="text-[10px] text-green-500 font-medium">Online • Ready to help</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {chatMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center">
              <Info className="text-orange-600 w-8 h-8" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white">How can I help you?</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[200px]">Ask about first aid, symptoms, or emergency procedures.</p>
            </div>
          </div>
        )}
        {chatMessages.map((msg, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] p-4 rounded-2xl text-sm ${
              msg.role === 'user' 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800 rounded-tl-none'
            }`}>
              {msg.text}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your question..."
            className="flex-1 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
          />
          <button 
            onClick={handleSendMessage}
            className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderHospitals = () => (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="h-[30vh] bg-slate-200 dark:bg-slate-800 relative shadow-inner overflow-hidden">
        <RealTimeMap 
          className="w-full h-full"
          destinations={MOCK_HOSPITALS.map(h => ({
            id: h.id,
            lat: h.lat,
            lng: h.lng,
            label: h.name
          }))}
          onDistancesCalculated={(results) => setRealTimeHospitalDistances(results)}
        />
        
        <button 
          onClick={() => setCurrentScreen('dashboard')}
          className="absolute top-6 left-6 p-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl shadow-lg z-20"
        >
          <ArrowLeft className="text-slate-900 dark:text-white" />
        </button>
      </div>

      <div className="flex-1 p-6 -mt-10 relative z-10 bg-slate-50 dark:bg-slate-950 rounded-t-[40px]">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Nearby Hospitals</h2>
          <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl shadow-sm flex items-center justify-center border border-slate-100 dark:border-slate-800">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-6 -mx-6 px-6 no-scrollbar">
          {['All', 'Nearest', 'ICU Available', 'Cardiology', 'Trauma'].map(filter => (
            <button key={filter} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-semibold whitespace-nowrap text-slate-600 dark:text-slate-400">
              {filter}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {MOCK_HOSPITALS.map(hospital => {
            const rtDist = realTimeHospitalDistances.find(d => d.id === hospital.id);
            return (
              <motion.div 
                key={hospital.id}
                whileTap={{ scale: 0.98 }}
                className="p-4 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800"
              >
                <div className="flex gap-4 mb-4">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-2xl overflow-hidden shrink-0">
                    <img src={`https://picsum.photos/seed/${hospital.id}/200/200`} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h5 className="font-bold text-slate-900 dark:text-white">{hospital.name}</h5>
                      <div className="flex items-center gap-1 text-orange-500">
                        <Activity className="w-3 h-3" />
                        <span className="text-[10px] font-bold">{hospital.rating}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1">
                      {rtDist?.duration || hospital.distance} ({rtDist?.distance || 'calculating...'})
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 truncate max-w-[150px]">
                      <MapPin className="w-3 h-3" /> {hospital.address}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {hospital.specialization.slice(0, 2).map((s, i) => (
                        <span key={`${s}-${i}`} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] rounded-md font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Beds</p>
                      <p className={`text-sm font-bold ${hospital.bedAvailability > 10 ? 'text-green-500' : 'text-orange-500'}`}>
                        {hospital.bedAvailability} Available
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">ICU</p>
                      <p className={`text-sm font-bold ${hospital.icuAvailability > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                        {hospital.icuAvailability} Available
                      </p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold">Details</button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentScreen('dashboard')} className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
            <ArrowLeft className="text-slate-900 dark:text-white" />
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Hospital Admin</h2>
        </div>
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">H</div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">Total Beds</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">150</h3>
          <p className="text-[10px] text-green-500 font-medium mt-2">+5 since yesterday</p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-400 font-bold uppercase mb-1">ICU Capacity</p>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">24</h3>
          <p className="text-[10px] text-red-500 font-medium mt-2">85% Occupied</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <h4 className="font-bold text-slate-900 dark:text-white mb-6">Update Availability</h4>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">General Beds Available</label>
            <div className="flex items-center gap-4">
              <button className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl font-bold">-</button>
              <input type="number" defaultValue={15} className="flex-1 h-12 text-center bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-lg" />
              <button className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xl font-bold">+</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">ICU Beds Available</label>
            <div className="flex items-center gap-4">
              <button className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl font-bold">-</button>
              <input type="number" defaultValue={4} className="flex-1 h-12 text-center bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-lg" />
              <button className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xl font-bold">+</button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Emergency Status</label>
            <select className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-bold text-sm outline-none">
              <option>Normal Operations</option>
              <option>High Demand</option>
              <option>Critical / Diversion</option>
            </select>
          </div>
          <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 dark:shadow-none">
            Update Real-time Sync
          </button>
        </div>
      </div>
    </div>
  );

  const renderPatients = () => (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentScreen('dashboard')} className="p-2 bg-white dark:bg-slate-900 rounded-xl shadow-sm">
            <ArrowLeft className="text-slate-900 dark:text-white" />
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Patient Profiles</h2>
        </div>
        <button className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 dark:shadow-none">
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="space-y-4">
        {patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-3xl flex items-center justify-center mb-4">
              <User className="text-slate-300 w-10 h-10" />
            </div>
            <h4 className="font-bold text-slate-900 dark:text-white">No Patients Added</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Add family members for quick access during emergencies.</p>
            <button 
              onClick={() => setIsAddingPatient(true)}
              className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
            >
              Add First Patient
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button 
              onClick={() => setIsAddingPatient(true)}
              className="w-full p-4 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-blue-600 font-bold"
            >
              <Plus className="w-5 h-5" /> Add New Patient
            </button>
            {patients.map((patient, pIdx) => (
              <div key={`${patient.id}-${pIdx}`} className="p-6 bg-white dark:bg-slate-900 rounded-[32px] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                    <User className="text-blue-600 dark:text-blue-400 w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-lg">{patient.firstName} {patient.lastName}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{patient.dob} • {patient.gender}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Blood Group</p>
                    <p className="font-bold text-red-500">{patient.bloodGroup}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Problem Type</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200">{patient.problemType}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Medical History</span>
                    <span className="font-medium dark:text-white">{patient.medicalHistory || 'None'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Allergies</span>
                    <span className="font-medium dark:text-white">{patient.allergies || 'None'}</span>
                  </div>
                </div>

              {/* Medical Records Section */}
              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> Medical Records
                  </h5>
                  <label className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors">
                    <Upload className="w-5 h-5" />
                    <input 
                      type="file" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const newRecord: MedicalRecord = {
                            id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            title: file.name.split('.')[0],
                            type: 'Prescription', // Default
                            date: new Date().toISOString(),
                            fileName: file.name,
                            isPrivate: false
                          };
                          const updatedPatient = { 
                            ...patient, 
                            medicalRecords: [...(patient.medicalRecords || []), newRecord] 
                          };
                          savePatient(updatedPatient);
                          addNotification('Record uploaded successfully!');
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  {(!patient.medicalRecords || patient.medicalRecords.length === 0) ? (
                    <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
                      <FileUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-500">No records uploaded yet</p>
                    </div>
                  ) : (
                    patient.medicalRecords.map((record, rIdx) => (
                      <div key={`${record.id}-${rIdx}`} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h6 className="text-sm font-bold text-slate-900 dark:text-white truncate">{record.title}</h6>
                          <p className="text-[10px] text-slate-500">{record.type} • {new Date(record.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              const updatedPatient = { 
                                ...patient, 
                                medicalRecords: patient.medicalRecords?.map(r => 
                                  r.id === record.id ? { ...r, isPrivate: !r.isPrivate } : r
                                ) 
                              };
                              savePatient(updatedPatient);
                              addNotification(record.isPrivate ? 'Record is now public for emergency services' : 'Record is now private');
                            }}
                            className={`p-2 rounded-lg transition-colors ${record.isPrivate ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-green-500 bg-green-50 dark:bg-green-900/20'}`}
                            title={record.isPrivate ? 'Private' : 'Shared with Emergency Services'}
                          >
                            {record.isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          <button 
                            onClick={() => {
                              const updatedPatient = { 
                                ...patient, 
                                medicalRecords: patient.medicalRecords?.filter(r => r.id !== record.id) 
                              };
                              savePatient(updatedPatient);
                              addNotification('Record deleted');
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2">
                  <Settings className="w-5 h-5" /> Edit Profile
                </button>
                <button 
                  onClick={() => {
                    addNotification('Emergency access link generated and shared with local services');
                  }}
                  className="px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  <Share2 className="w-5 h-5" /> Share
                </button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <div className={`min-h-screen font-sans selection:bg-blue-100 selection:text-blue-600`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {currentScreen === 'welcome' && renderWelcome()}
            {currentScreen === 'auth' && renderAuth()}
            {currentScreen === 'dashboard' && renderDashboard()}
            {currentScreen === 'emergency' && renderEmergency()}
            {currentScreen === 'ambulance' && renderAmbulance()}
            {currentScreen === 'chatbot' && renderChatbot()}
            {currentScreen === 'hospitals' && renderHospitals()}
            {currentScreen === 'admin' && renderAdmin()}
            {currentScreen === 'learnMore' && renderLearnMore()}
          </motion.div>
        </AnimatePresence>

        {/* Vitals Prompt Modal */}
        <AnimatePresence>
          {showVitalsPrompt && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-2xl text-center"
              >
                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Activity className="text-blue-600 dark:text-blue-400 w-10 h-10 animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sync Vitals</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                  Connect your wearable band device to start syncing real-time health data like heart rate and SpO2.
                </p>
                <div className="space-y-3">
                  <button 
                    onClick={() => {
                      setShowVitalsPrompt(false);
                      addNotification('Searching for devices...', 'info');
                    }}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    Connect Device
                  </button>
                  <button 
                    onClick={() => setShowVitalsPrompt(false)}
                    className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-semibold"
                  >
                    Maybe Later
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications Toast */}
        <div className="fixed top-6 right-6 z-[200] pointer-events-none space-y-2 max-w-[calc(100%-3rem)] sm:max-w-xs w-full">
          {notifications.map(n => (
            <motion.div 
              key={n.id}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`p-4 rounded-2xl shadow-lg flex items-center gap-3 pointer-events-auto ${
                n.type === 'alert' ? 'bg-red-500 text-white' : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white'
              }`}
            >
              {n.type === 'alert' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />}
              <p className="text-sm font-medium">{n.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Add Patient Modal */}
        <AnimatePresence>
          {isAddingPatient && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-2xl my-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add Patient Profile</h3>
                  <button onClick={() => setIsAddingPatient(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">First Name</label>
                      <input 
                        type="text" 
                        value={newPatientForm.firstName}
                        onChange={(e) => setNewPatientForm({...newPatientForm, firstName: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Last Name</label>
                      <input 
                        type="text" 
                        value={newPatientForm.lastName}
                        onChange={(e) => setNewPatientForm({...newPatientForm, lastName: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Date of Birth</label>
                      <input 
                        type="date" 
                        value={newPatientForm.dob}
                        max={new Date().toISOString().split('T')[0]}
                        min={(() => {
                          const minDate = new Date();
                          minDate.setFullYear(minDate.getFullYear() - 105);
                          return minDate.toISOString().split('T')[0];
                        })()}
                        onChange={(e) => setNewPatientForm({...newPatientForm, dob: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Gender</label>
                      <select 
                        value={newPatientForm.gender}
                        onChange={(e) => setNewPatientForm({...newPatientForm, gender: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Problem Type</label>
                    <select 
                      value={newPatientForm.problemType}
                      onChange={(e) => setNewPatientForm({...newPatientForm, problemType: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    >
                      <option value="None">None</option>
                      <option value="Diabetes">Diabetes</option>
                      <option value="High BP">High BP</option>
                      <option value="Asthma">Asthma</option>
                      <option value="Heart Condition">Heart Condition</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {newPatientForm.problemType === 'Other' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Specify Problem</label>
                      <input 
                        type="text" 
                        value={newPatientForm.otherProblem}
                        onChange={(e) => setNewPatientForm({...newPatientForm, otherProblem: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        placeholder="Enter condition..."
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Blood Group</label>
                      <select 
                        value={newPatientForm.bloodGroup}
                        onChange={(e) => setNewPatientForm({...newPatientForm, bloodGroup: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                      >
                        <option>A+</option>
                        <option>A-</option>
                        <option>B+</option>
                        <option>B-</option>
                        <option>O+</option>
                        <option>O-</option>
                        <option>AB+</option>
                        <option>AB-</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">Allergies</label>
                      <input 
                        type="text" 
                        value={newPatientForm.allergies}
                        onChange={(e) => setNewPatientForm({...newPatientForm, allergies: e.target.value})}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                        placeholder="e.g. Peanuts, Penicillin"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Medical History</label>
                    <textarea 
                      value={newPatientForm.medicalHistory}
                      onChange={(e) => setNewPatientForm({...newPatientForm, medicalHistory: e.target.value})}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-white h-20 resize-none"
                      placeholder="Any past surgeries or chronic conditions..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">Upload Past Records</label>
                    <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center hover:border-blue-500 transition-colors group">
                      <input 
                        type="file" 
                        id="patient-records-upload"
                        className="hidden" 
                        multiple
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            const newRecords: MedicalRecord[] = [];
                            let processed = 0;
                            
                            Array.from(files).forEach((file: any) => {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                newRecords.push({
                                  id: `rec_${Date.now()}_${processed}_${Math.random().toString(36).substr(2, 5)}`,
                                  title: file.name.split('.')[0],
                                  type: 'Prescription',
                                  date: new Date().toLocaleDateString(),
                                  fileName: file.name,
                                  isPrivate: false,
                                  base64Data: reader.result as string
                                });
                                processed++;
                                if (processed === files.length) {
                                  setNewPatientForm(prev => ({
                                    ...prev,
                                    medicalRecords: [...prev.medicalRecords, ...newRecords]
                                  }));
                                  addNotification(`${files.length} document(s) attached to profile`);
                                }
                              };
                              reader.readAsDataURL(file);
                            });
                          }
                        }}
                      />
                      <label htmlFor="patient-records-upload" className="cursor-pointer">
                        <Upload className="w-10 h-10 text-blue-600 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-1">Add Medical Records</h4>
                        <p className="text-xs text-slate-500">Attach prescriptions, lab reports, or X-rays</p>
                      </label>
                    </div>

                    {newPatientForm.medicalRecords.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {newPatientForm.medicalRecords.map((record, rIdx) => (
                          <div key={`${record.id}-${rIdx}`} className="relative group overflow-hidden border border-slate-100 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm p-3 flex flex-col items-center">
                            {record.base64Data?.startsWith('data:image/') ? (
                              <img 
                                src={record.base64Data} 
                                alt={record.title}
                                className="w-full h-24 object-cover rounded-lg mb-2 shadow-inner"
                              />
                            ) : (
                              <div className="w-full h-24 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2 flex items-center justify-center">
                                <FileText className="w-8 h-8 text-blue-600 opacity-40" />
                              </div>
                            )}
                            <div className="w-full text-center">
                              <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{record.fileName}</p>
                            </div>
                            <div className="absolute top-1 right-1 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setPreviewRecord(record)}
                                className="p-1.5 bg-white/90 dark:bg-slate-800/90 rounded-lg text-blue-600 shadow-lg"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => setNewPatientForm(prev => ({
                                  ...prev,
                                  medicalRecords: prev.medicalRecords.filter(r => r.id !== record.id)
                                }))}
                                className="p-1.5 bg-white/90 dark:bg-slate-800/90 rounded-lg text-red-500 shadow-lg"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <button 
                    onClick={async () => {
                      if (!newPatientForm.firstName || !newPatientForm.lastName) {
                        addNotification('Please enter first and last name', 'alert');
                        return;
                      }

                      if (!newPatientForm.dob) {
                        addNotification('Please enter Date of Birth', 'alert');
                        return;
                      }

                      const selectedDate = new Date(newPatientForm.dob);
                      const today = new Date();
                      const minDate = new Date();
                      minDate.setFullYear(today.getFullYear() - 105);

                      if (selectedDate > today) {
                        addNotification('Date of Birth cannot be in the future', 'alert');
                        return;
                      }

                      if (selectedDate < minDate) {
                        addNotification('Age cannot exceed 105 years', 'alert');
                        return;
                      }

                      const patient: Patient = {
                        id: '',
                        firstName: newPatientForm.firstName,
                        lastName: newPatientForm.lastName,
                        dob: newPatientForm.dob,
                        gender: newPatientForm.gender,
                        problemType: newPatientForm.problemType === 'Other' ? newPatientForm.otherProblem : newPatientForm.problemType,
                        medicalHistory: newPatientForm.medicalHistory,
                        allergies: newPatientForm.allergies,
                        bloodGroup: newPatientForm.bloodGroup,
                        idType: newPatientForm.idType,
                        idNumber: newPatientForm.idNumber,
                        medicalRecords: newPatientForm.medicalRecords
                      };

                      try {
                        setIsCreatingPatient(true);
                        await savePatient(patient);
                        setIsAddingPatient(false);
                        setNewPatientForm({
                          firstName: '',
                          lastName: '',
                          dob: '',
                          gender: 'Male',
                          problemType: 'None',
                          otherProblem: '',
                          medicalHistory: '',
                          allergies: '',
                          bloodGroup: 'O+',
                          idType: 'Aadhaar',
                          idNumber: '',
                          medicalRecords: [],
                        });
                        addNotification('Patient profile created successfully!');
                      } catch (error: any) {
                        console.error("Failed to add patient:", error);
                        const errorMessage = error?.message || 'Please try again';
                        addNotification(`Error: ${errorMessage.slice(0, 45)}...`, 'alert');
                      } finally {
                        setIsCreatingPatient(false);
                      }
                    }}
                    disabled={isCreatingPatient}
                    className={`w-full py-4 text-white rounded-2xl font-bold shadow-lg transition-all ${isCreatingPatient ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-blue-600 shadow-blue-200 dark:shadow-none hover:bg-blue-700'}`}
                  >
                    {isCreatingPatient ? 'Creating Profile...' : 'Create Profile'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Patient List Modal */}
          {showPatientsModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-lg bg-slate-50 dark:bg-slate-950 rounded-[32px] p-0 shadow-2xl my-8 overflow-hidden"
              >
                <div className="p-6 bg-white dark:bg-slate-900 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Patient Profiles</h3>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                      {patients.length}
                    </span>
                  </div>
                  <button onClick={() => setShowPatientsModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-left">
                  {patients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                       <User className="w-12 h-12 mb-2 opacity-20" />
                       <p>No patients added yet.</p>
                    </div>
                  ) : (
                    patients.map((p, idx) => (
                      <div 
                        key={`${p.id}-${idx}`}
                        onClick={() => {
                          setSelectedPatient(p);
                        }}
                        className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 cursor-pointer hover:border-blue-500 transition-all"
                      >
                        <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                          <User className="text-blue-600 w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">{p.firstName} {p.lastName}</h4>
                          <p className="text-[10px] text-slate-500">{p.dob} • {p.bloodGroup}</p>
                        </div>
                        <ChevronRight className="text-slate-300 w-5 h-5" />
                      </div>
                    ))
                  )}
                  
                  <button 
                    onClick={() => setIsAddingPatient(true)}
                    className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-dashed border-blue-200 dark:border-blue-800 flex items-center justify-center gap-2 text-blue-600 font-bold"
                  >
                    <Plus className="w-5 h-5" /> Add New Profile
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Patient Detail Modal */}
          {selectedPatient && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-2xl my-8 relative"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Patient Detail</h3>
                  <button onClick={() => setSelectedPatient(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar text-left">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center shadow-inner">
                      <User className="text-blue-600 dark:text-blue-400 w-10 h-10" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {selectedPatient.firstName} {selectedPatient.lastName}
                      </h4>
                      <p className="text-slate-500 font-medium">{selectedPatient.dob} • {selectedPatient.gender}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Blood Group</p>
                      <p className="text-lg font-bold text-red-500">{selectedPatient.bloodGroup}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Problem</p>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{selectedPatient.problemType}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Medical History</h5>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {selectedPatient.medicalHistory || 'No medical history reported.'}
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h5 className="text-xs font-bold text-slate-400 uppercase mb-2">Allergies</h5>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {selectedPatient.allergies || 'No allergies reported.'}
                      </p>
                    </div>
                  </div>

                  {/* Record Section in Detail Modal */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" /> Medical Records
                      </h5>
                      <button 
                        onClick={() => setShowUploadModal(true)}
                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors"
                      >
                        <Plus className="w-3 h-3" /> Add Record
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(!selectedPatient.medicalRecords || selectedPatient.medicalRecords.length === 0) ? (
                        <div className="p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-center">
                          <p className="text-xs text-slate-400 italic">No records uploaded yet.</p>
                        </div>
                      ) : (
                        selectedPatient.medicalRecords.map((record, rIdx) => (
                          <div key={`${record.id}-${rIdx}`} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center gap-3 group">
                            <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center border border-slate-100 dark:border-slate-600">
                               <FileText className="w-5 h-5 text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{record.title}</p>
                               <div className="flex items-center gap-2 mt-0.5">
                                 <p className="text-[10px] text-slate-500">{record.type} • {record.date}</p>
                                 {record.fileName && (
                                   <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded truncate max-w-[100px]">
                                     {record.fileName}
                                   </span>
                                 )}
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {record.isPrivate ? <Lock className="w-3 h-3 text-slate-400" /> : <Unlock className="w-3 h-3 text-green-500" />}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setPreviewRecord(record)}
                                  className="p-2 hover:bg-blue-50 text-slate-300 hover:text-blue-500 rounded-lg transition-colors"
                                  title="View Document"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedRecords = selectedPatient.medicalRecords?.filter(r => r.id !== record.id) || [];
                                    const updatedPatient = { ...selectedPatient, medicalRecords: updatedRecords };
                                    savePatient(updatedPatient);
                                    setSelectedPatient(updatedPatient);
                                    addNotification('Document deleted successfully');
                                  }}
                                  className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-bold">
                    Edit
                  </button>
                  <button 
                    onClick={() => {
                        addNotification('Emergency access link shared with hospital network');
                    }}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold"
                  >
                    Share
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Aggregated Medical Records Modal */}
          {showRecordsModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-lg bg-slate-50 dark:bg-slate-950 rounded-[32px] p-0 shadow-2xl my-8 overflow-hidden"
              >
                <div className="p-6 bg-white dark:bg-slate-900 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                      <FileText className="text-purple-600 w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Medical Documents</h3>
                  </div>
                  <button onClick={() => setShowRecordsModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-left">
                  {(() => {
                    const allRecords = patients.flatMap(p => 
                      (p.medicalRecords || []).map(r => ({ ...r, patientName: `${p.firstName} ${p.lastName}`, patientId: p.id }))
                    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    if (allRecords.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 opacity-20" />
                          </div>
                          <p className="font-bold">No documents found.</p>
                          <p className="text-xs px-12">Upload reports, prescriptions, or vaccination records within a patient profile.</p>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/20 flex gap-3 mb-4">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                          <p className="text-[10px] text-blue-700 dark:text-blue-300">
                            These documents are securely stored and encrypted. Only you and your assigned medical team can access them during emergencies.
                          </p>
                        </div>
                        {allRecords.map((record, idx) => (
                          <div 
                            key={`${record.patientId}-${record.id}-${idx}`}
                            className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-500 transition-all cursor-pointer group"
                            onClick={() => {
                              const p = patients.find(p => p.id === record.patientId);
                              if (p) {
                                setSelectedPatient(p);
                                setShowRecordsModal(false);
                              }
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                <FileText className="w-6 h-6" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{record.title}</h4>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[8px] font-bold rounded uppercase">
                                    {record.type}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    • {record.patientName}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-[10px] text-slate-400">{record.date}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewRecord(record);
                                    }}
                                    className="p-1 px-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                                  >
                                    View
                                  </button>
                                  {record.isPrivate ? (
                                    <Lock className="w-3 h-3 text-slate-300" />
                                  ) : (
                                    <Unlock className="w-3 h-3 text-green-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* SOS Contacts Modal */}
          {showSOSModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[140] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="w-full max-w-lg bg-slate-50 dark:bg-slate-950 rounded-[32px] p-0 shadow-2xl my-8 overflow-hidden"
              >
                <div className="p-6 bg-white dark:bg-slate-900 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                      <AlertCircle className="text-red-600 w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">SOS Contacts</h3>
                  </div>
                  <button onClick={() => setShowSOSModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-left text-sm">
                  {isAddingSOSContact ? (
                    <div className="space-y-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <h4 className="font-bold text-slate-900 dark:text-white">New Contact</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                          <input 
                            type="text" 
                            value={newSOSContact.name}
                            onChange={(e) => setNewSOSContact({...newSOSContact, name: e.target.value})}
                            placeholder="John Doe"
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Phone Number</label>
                          <input 
                            type="tel" 
                            value={newSOSContact.phone}
                            onChange={(e) => setNewSOSContact({...newSOSContact, phone: e.target.value})}
                            placeholder="+91 XXXXX XXXXX"
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Relation</label>
                          <input 
                            type="text" 
                            value={newSOSContact.relation}
                            onChange={(e) => setNewSOSContact({...newSOSContact, relation: e.target.value})}
                            placeholder="Father, Friend, etc."
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none mt-1"
                          />
                        </div>
                        <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={newSOSContact.isPriority}
                            onChange={(e) => setNewSOSContact({...newSOSContact, isPriority: e.target.checked})}
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Set as Priority Contact</span>
                        </label>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => setIsAddingSOSContact(false)}
                          className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => {
                            if (newSOSContact.name && newSOSContact.phone) {
                              saveSOSContact(newSOSContact);
                              setIsAddingSOSContact(false);
                              setNewSOSContact({ name: '', phone: '', relation: '', isPriority: false });
                              addNotification('SOS contact added successfully');
                            }
                          }}
                          className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                        >
                          Save Contact
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {sosContacts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                            <User className="w-8 h-8 opacity-20" />
                          </div>
                          <p className="font-bold">No SOS contacts added yet.</p>
                          <p className="text-xs px-12">Add friends and family members who should be notified in case of an emergency.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sosContacts.map(contact => (
                            <div key={contact.id} className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${contact.isPriority ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                <User className="w-6 h-6" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-slate-900 dark:text-white">{contact.name}</h4>
                                  {contact.isPriority && (
                                    <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 text-[8px] font-bold rounded uppercase">Priority</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">{contact.relation} • {contact.phone}</p>
                              </div>
                              <button 
                                onClick={() => deleteSOSContact(contact.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button 
                        onClick={() => setIsAddingSOSContact(true)}
                        className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-dashed border-blue-200 dark:border-blue-800 flex items-center justify-center gap-2 text-blue-600 font-bold"
                      >
                        <Plus className="w-5 h-5" /> Add Emergency Contact
                      </button>
                    </>
                  )}
                  
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100 dark:border-yellow-800/20 flex gap-3">
                    <Info className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      In an emergency, your location and a tracking link will be sent to your priority contacts via SMS.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Upload Medical Record Modal */}
          {showUploadModal && selectedPatient && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-2xl relative"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Upload Record</h3>
                  <button onClick={() => setShowUploadModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-6 text-left">
                  <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-slate-950/50 group hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden">
                    {newRecordForm.base64Data ? (
                      newRecordForm.base64Data.startsWith('data:image/') ? (
                        <div className="relative group/preview">
                          <img 
                            src={newRecordForm.base64Data} 
                            alt="preview" 
                            className="w-32 h-32 object-cover rounded-2xl shadow-xl border-4 border-white dark:border-slate-800"
                          />
                          <div className="absolute inset-0 bg-blue-600/10 rounded-2xl flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity">
                            <span className="bg-white dark:bg-slate-800 text-blue-600 text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">Change File</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-4">
                           <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mx-auto flex items-center justify-center border-2 border-blue-200 dark:border-blue-800 shadow-sm mb-2">
                             <FileText className="w-10 h-10 text-blue-600" />
                           </div>
                           <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{newRecordForm.fileName}</p>
                        </div>
                      )
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-slate-300 group-hover:text-blue-500 transition-colors group-hover:scale-110 transition-transform" />
                        <div className="text-center">
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Select Document</p>
                          <p className="text-[10px] text-slate-500">PDF, JPG, PNG (Max 5MB)</p>
                        </div>
                      </>
                    )}
                    <input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setNewRecordForm({
                              ...newRecordForm, 
                              title: file.name.split('.')[0],
                              fileName: file.name,
                              base64Data: reader.result as string
                            });
                            addNotification(`File "${file.name}" selected`);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>

                  {newRecordForm.fileName && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-between border border-blue-100 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">File selected and ready to sync</span>
                      </div>
                      <button 
                        onClick={(e) => {
                           e.stopPropagation();
                           setNewRecordForm({...newRecordForm, fileName: undefined, base64Data: undefined})
                        }}
                        className="text-[10px] font-bold text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Document Title</label>
                      <input 
                        type="text" 
                        value={newRecordForm.title}
                        onChange={(e) => setNewRecordForm({...newRecordForm, title: e.target.value})}
                        placeholder="e.g. Blood Test Result"
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none mt-1 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Type</label>
                      <select 
                        value={newRecordForm.type}
                        onChange={(e) => setNewRecordForm({...newRecordForm, type: e.target.value as any})}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border-none focus:ring-2 focus:ring-blue-500 outline-none mt-1 dark:text-white text-sm"
                      >
                        <option>Prescription</option>
                        <option>Lab Report</option>
                        <option>Vaccination</option>
                        <option>Doctor Note</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={newRecordForm.isPrivate}
                        onChange={(e) => setNewRecordForm({...newRecordForm, isPrivate: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Keep Private</p>
                        <p className="text-[10px] text-slate-500">Only visible to you and authorized doctors</p>
                      </div>
                      <Lock className="w-4 h-4 text-slate-400" />
                    </label>
                  </div>

                  <button 
                    onClick={async () => {
                      if (newRecordForm.title) {
                        const newRecord: MedicalRecord = {
                          id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                          title: newRecordForm.title,
                          type: newRecordForm.type,
                          date: new Date().toLocaleDateString(),
                          fileName: newRecordForm.fileName || 'Untitled',
                          isPrivate: newRecordForm.isPrivate,
                          base64Data: newRecordForm.base64Data
                        };
                        const updatedRecords = [...(selectedPatient.medicalRecords || []), newRecord];
                        const updatedPatient = { ...selectedPatient, medicalRecords: updatedRecords };
                        try {
                          await savePatient(updatedPatient);
                          setSelectedPatient(updatedPatient);
                          setShowUploadModal(false);
                          setNewRecordForm({ title: '', type: 'Prescription', isPrivate: false, fileName: undefined, base64Data: undefined });
                          addNotification('Document uploaded successfully');
                        } catch (err) {
                          addNotification('Failed to upload document', 'alert');
                        }
                      }
                    }}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 transition-colors"
                  >
                    Upload Document
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* Logout Confirmation Modal */}
          <AnimatePresence>
            {previewRecord && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
                >
                  <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate max-w-[300px]">
                        {previewRecord.title}
                      </h3>
                      <p className="text-xs text-slate-500">{previewRecord.fileName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = previewRecord.base64Data || '';
                          link.download = previewRecord.fileName || 'document';
                          link.click();
                        }}
                        className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 hover:text-blue-600"
                        title="Download"
                      >
                        <Download className="w-5 h-5" />
                      </button>
                      <button onClick={() => setPreviewRecord(null)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <X className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto p-4 flex items-center justify-center min-h-[300px]">
                    {previewRecord.base64Data ? (
                      previewRecord.base64Data.startsWith('data:image/') ? (
                        <img 
                          src={previewRecord.base64Data} 
                          alt={previewRecord.title}
                          className="max-w-full h-auto rounded-lg shadow-lg"
                        />
                      ) : previewRecord.base64Data.startsWith('data:application/pdf') ? (
                        <iframe 
                          src={previewRecord.base64Data} 
                          className="w-full h-full min-h-[500px] border-none rounded-lg"
                          title="PDF Preview"
                        />
                      ) : (
                        <div className="text-center p-12">
                          <FileText className="w-20 h-20 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-500">Preview not available for this file type.</p>
                          <p className="text-sm text-slate-400 mt-2">{previewRecord.fileName}</p>
                        </div>
                      )
                    ) : (
                      <div className="text-center p-12">
                        <FileText className="w-20 h-20 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">No file content available.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logout Confirmation Modal */}
          <AnimatePresence>
            {showLogoutConfirm && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
                onClick={() => setShowLogoutConfirm(false)}
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[32px] p-8 shadow-2xl overflow-hidden relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <LogOut className="text-red-600 w-8 h-8" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">Logout</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-center mb-8">
                    Are you sure you want to logout from LifeLine AI?
                  </p>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        setUser(null);
                        setPatients([]);
                        setPhoneInput('');
                        setOtpInput(['', '', '', '']);
                        setIsOtpSent(false);
                        setCurrentScreen('welcome');
                        setShowLogoutConfirm(false);
                        addNotification('Logged out successfully');
                      }}
                      className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-200 dark:shadow-none transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
