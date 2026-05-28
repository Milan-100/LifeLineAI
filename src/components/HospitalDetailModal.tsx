import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Phone, Star, Bed, Activity, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Hospital } from '../types';

interface HospitalDetailModalProps {
  hospital: Hospital | null;
  onClose: () => void;
  realTimeDistance?: { distance: string; duration: string };
}

export const HospitalDetailModal: React.FC<HospitalDetailModalProps> = ({
  hospital,
  onClose,
  realTimeDistance,
}) => {
  if (!hospital) return null;

  const images = hospital.images || [
    `https://images.unsplash.com/photo-1587351021355-a479a299d2f9?auto=format&fit=crop&q=80&w=600`
  ];

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  // Safe Google Maps fallback
  const mapsUrl = hospital.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + hospital.address)}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl relative text-left border border-slate-100 dark:border-slate-800"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Carousel Image and Close Controller */}
          <div className="relative h-64 bg-slate-100 dark:bg-slate-800 overflow-hidden group">
            <img
              src={images[activeImageIndex]}
              alt={hospital.name}
              className="w-full h-full object-cover transition-transform duration-500 ease-out"
              referrerPolicy="no-referrer"
            />
            {/* Linear Gradient Overlay for readability of details */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

            {/* Back / Next Controls for Carousel */}
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full transition-all backdrop-blur-xs opacity-0 group-hover:opacity-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 text-white rounded-full transition-all backdrop-blur-xs opacity-0 group-hover:opacity-100"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Close button top right */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2.5 bg-black/40 hover:bg-black/60 text-white rounded-full backdrop-blur-sm transition-all shadow-lg border border-white/10"
              id="close-hospital-modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Carousel dots indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex(idx);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === activeImageIndex ? 'bg-white w-4' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Modal Metadata Panel */}
          <div className="p-6">
            <div className="flex justify-between items-start gap-4 mb-3">
              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full mb-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {realTimeDistance?.duration || hospital.distance} Away
                </span>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                  {hospital.name}
                </h3>
              </div>
              
              <div className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-2xl font-bold text-sm border border-amber-100 dark:border-amber-900/50 shrink-0">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>{hospital.rating.toFixed(1)}</span>
              </div>
            </div>

            {/* Emergency Beds Availability indicators */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1.5">
                  <Bed className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">General Beds</span>
                </div>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {hospital.bedAvailability} <span className="text-xs font-semibold text-emerald-600/80 dark:text-emerald-400/80">Available</span>
                </p>
              </div>

              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1.5">
                  <Activity className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">ICU Beds</span>
                </div>
                <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
                  {hospital.icuAvailability} <span className="text-xs font-semibold text-blue-600/80 dark:text-blue-400/80">Available</span>
                </p>
              </div>
            </div>

            {/* Hospital Contact Info / details */}
            <div className="space-y-4 mb-6">
              <div className="flex gap-3 items-start">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl shrink-0 border border-slate-100 dark:border-slate-800">
                  <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Address</h4>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    {hospital.address}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl shrink-0 border border-slate-100 dark:border-slate-800">
                  <Phone className="w-4 h-4 text-slate-500" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Contact Desk</h4>
                  <a
                    href={`tel:${hospital.contact.replace(/\s+/g, '')}`}
                    className="text-sm font-semibold text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors inline-block mt-0.5"
                  >
                    {hospital.contact}
                  </a>
                </div>
              </div>

              {/* Specialities Tags */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Specializations Available</h4>
                <div className="flex flex-wrap gap-2">
                  {hospital.specialization.map((spec, i) => (
                    <span
                      key={`${spec}-${i}`}
                      className="px-3 py-1 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium border border-slate-100 dark:border-slate-800"
                    >
                      {spec}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Google Maps Actions Cards (Interactive Destination Redirect) */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-md group border border-transparent dark:border-slate-200"
              id="google-maps-link-btn"
            >
              <ExternalLink className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              <span>Navigate on Google Maps</span>
            </a>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
