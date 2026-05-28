import { Hospital, Ambulance } from './types';

export const MOCK_HOSPITALS: Hospital[] = [
  {
    id: '1',
    name: 'AIIMS Delhi',
    distance: '50 km',
    bedAvailability: 15,
    icuAvailability: 4,
    specialization: ['Cardiology', 'Trauma', 'Pediatrics'],
    contact: '+91 11 2658 8500',
    address: 'Ansari Nagar, New Delhi, Delhi 110029',
    rating: 4.9,
    lat: 28.5672,
    lng: 77.2100
  },
  {
    id: '4',
    name: 'SGT Hospital',
    distance: '14 km',
    bedAvailability: 22,
    icuAvailability: 6,
    specialization: ['General Medicine', 'Emergency Medicine', 'Orthopedics'],
    contact: '+91 124 227 8184',
    address: 'Chandu-Budhera, Gurugram-Badli Road, Gurugram, Haryana 122505',
    rating: 4.6,
    lat: 28.4878,
    lng: 76.9042
  },
  {
    id: '2',
    name: 'Apollo Hospital Bangalore',
    distance: '2.5 km',
    bedAvailability: 8,
    icuAvailability: 0,
    specialization: ['Neurology', 'Orthopedics'],
    contact: '+91 80 2630 4050',
    address: '154/11, Bannerghatta Road, Bangalore, Karnataka 560076',
    rating: 4.7,
    lat: 12.8959,
    lng: 77.5981
  },
  {
    id: '3',
    name: 'Fortis Memorial Research Institute',
    distance: '0.8 km',
    bedAvailability: 3,
    icuAvailability: 2,
    specialization: ['Emergency Medicine', 'Oncology'],
    contact: '+91 124 4921 021',
    address: 'Sector 44, Gurugram, Haryana 122002',
    rating: 4.8,
    lat: 28.4485,
    lng: 77.0725
  }
];

export const AMBULANCE_TYPES: Ambulance[] = [
  { id: 'a1', type: 'Basic', eta: '5 min', distance: '1.2 km', price: '₹0,000' },
  { id: 'a2', type: 'Advanced', eta: '8 min', distance: '2.1 km', price: '₹0,000' },
  { id: 'a3', type: 'ICU', eta: '12 min', distance: '3.5 km', price: '₹0,000' }
];
