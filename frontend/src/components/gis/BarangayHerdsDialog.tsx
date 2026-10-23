'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import api from '@/lib/axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  Search,
  X,
  User,
  MapPin,
  Calendar,
  AlertCircle,
  Loader2,
  RefreshCw,
  Tag,
  ShieldCheck,
  Clock,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

export interface BarangayHerdItem {
  id: number;
  batch_name: string;
  batch_code: string;
  livestock_type?: number;
  livestock_type_name?: string;
  farmer?: number;
  farmer_name?: string;
  barangay_name?: string;
  housing_pen?: string;
  feed_type?: string;
  total_animals?: number;
  active_animal_count?: number;
  enrolled_animals?: number;
  average_weight?: string | number | null;
  status: string;
  review_status?: string;
  created_at?: string;
  photo_url?: string | null;
  photo?: string | null;
}

interface BarangayHerdsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barangayName: string;
  barangayId: number | null;
}

const CANONICAL_BARANGAYS: Record<string, number> = {
  banaba: 1,
  manggas: 2,
  pansol: 3,
  cawongan: 4,
  payapa: 5,
  poblacion: 6,
  'quilo-quilo north': 7,
  'quilo-quilo south': 8,
  'san felipe': 9,
  'san miguel': 10,
  tamak: 11,
  tangob: 12,
  banaybanay: 13,
  'banay-banay': 13,
  bawi: 14,
  bukal: 15,
  castillo: 16,
  'maugat east': 17,
  'maugat west': 18,
};

const SPECIES_EMOJI: Record<string, string> = {
  cattle: '🐄',
  carabao: '🐃',
  swine: '🐖',
  pig: '🐖',
  goat: '🐐',
  sheep: '🐑',
  poultry: '🐔',
  chicken: '🐔',
};

export function BarangayHerdsDialog({
  open,
  onOpenChange,
  barangayName,
  barangayId,
}: BarangayHerdsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState('ALL');

  const normalizedKey = (barangayName || '').trim().toLowerCase();
  const resolvedId = (barangayId && barangayId > 0) ? barangayId : (CANONICAL_BARANGAYS[normalizedKey] || 0);

  const {
    data: herds = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<BarangayHerdItem[]>({
    queryKey: ['barangay-active-herds', resolvedId, barangayName],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (resolvedId > 0) {
        params.set('barangay_id', String(resolvedId));
      } else if (barangayName) {
        params.set('barangay', barangayName);
      }
      params.set('status', 'ACTIVE');
      params.set('all', 'true');
      const res = await api.get(`livestock/batches/?${params.toString()}`);
      if (Array.isArray(res.data)) {
        return res.data;
      }
      if (res.data && Array.isArray(res.data.results)) {
        return res.data.results;
      }
      return [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (isAxiosError(error)) {
      const data = error.response?.data;
      if (typeof data === 'string') return data;
      if (data && typeof data === 'object') {
        if ('detail' in data && typeof (data as { detail?: unknown }).detail === 'string') {
          return (data as { detail: string }).detail;
        }
        if ('error' in data && typeof (data as { error?: unknown }).error === 'string') {
          return (data as { error: string }).error;
        }
        if ('message' in data && typeof (data as { message?: unknown }).message === 'string') {
          return (data as { message: string }).message;
        }
      }
      if (error.response?.status === 403) return 'You do not have permission to view herds in this barangay.';
      if (error.response?.status === 404) return 'Barangay records could not be found.';
      return error.message;
    }
    if (error instanceof Error) return error.message;
    return 'Could not retrieve herds for this barangay.';
  }, [error]);

  const availableSpecies = useMemo(() => {
    const set = new Set<string>();
    herds.forEach((h) => {
      if (h.livestock_type_name) set.add(h.livestock_type_name);
    });
    return Array.from(set);
  }, [herds]);

  const filteredHerds = useMemo(() => {
    let result = herds;

    if (selectedSpecies !== 'ALL') {
      result = result.filter(
        (h) => (h.livestock_type_name || '').toLowerCase() === selectedSpecies.toLowerCase()
      );
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase().trim();
    return result.filter(
      (h) =>
        (h.batch_name && h.batch_name.toLowerCase().includes(q)) ||
        (h.batch_code && h.batch_code.toLowerCase().includes(q)) ||
        (h.farmer_name && h.farmer_name.toLowerCase().includes(q)) ||
        (h.livestock_type_name && h.livestock_type_name.toLowerCase().includes(q)) ||
        (h.housing_pen && h.housing_pen.toLowerCase().includes(q))
    );
  }, [herds, searchQuery, selectedSpecies]);

  const getSpeciesEmoji = (speciesName?: string) => {
    if (!speciesName) return '🏷️';
    return SPECIES_EMOJI[speciesName.toLowerCase()] || '🏷️';
  };

  const getReviewBadge = (reviewStatus?: string) => {
    switch (reviewStatus?.toUpperCase()) {
      case 'APPROVED':
        return (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-bold">
            <CheckCircle2 className="size-3 mr-1 text-emerald-700" />
            Approved
          </Badge>
        );
      case 'VERIFIED':
        return (
          <Badge className="bg-sky-50 text-sky-800 border-sky-300 text-[10px] font-bold">
            <ShieldCheck className="size-3 mr-1 text-sky-700" />
            Verified
          </Badge>
        );
      case 'SUBJECT_TO_REVISION':
      case 'SUBJECT_FOR_REVISION':
        return (
          <Badge className="bg-rose-50 text-rose-800 border-rose-300 text-[10px] font-bold">
            <RotateCcw className="size-3 mr-1 text-rose-700" />
            Revision
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-bold">
            <Clock className="size-3 mr-1 text-slate-500" />
            Active
          </Badge>
        );
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Recorded';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] sm:max-h-[88dvh] overflow-hidden p-0 rounded-3xl border border-slate-200/90 bg-white shadow-2xl sm:w-[calc(100%-2rem)] sm:max-w-2xl flex flex-col z-[var(--z-dialog)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs">
              <TrendingUp className="size-5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                  Active Herds & Batches
                </DialogTitle>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-xs">
                  Brgy. {barangayName}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                Registered livestock herd groupings and active pens
              </DialogDescription>
            </div>
          </div>

          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* Search Bar & Species Filters */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/70 shrink-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by herd name, batch code, species, or raiser..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-xs rounded-xl bg-white border-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              className="size-9 rounded-xl border-slate-200 text-slate-600 shrink-0 cursor-pointer"
              title="Refresh herds list"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin text-emerald-600' : ''}`} />
            </Button>
          </div>

          {/* Species Pills */}
          {availableSpecies.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedSpecies('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedSpecies === 'ALL'
                    ? 'bg-emerald-700 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All ({herds.length})
              </button>
              {availableSpecies.map((sp) => {
                const count = herds.filter((h) => h.livestock_type_name === sp).length;
                return (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setSelectedSpecies(sp)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      selectedSpecies.toLowerCase() === sp.toLowerCase()
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{getSpeciesEmoji(sp)}</span>
                    <span>{sp}</span>
                    <span className="text-[10px] opacity-80">({count})</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-0.5">
            <span>
              Showing <strong className="text-slate-800">{filteredHerds.length}</strong> of{' '}
              <strong className="text-slate-800">{herds.length}</strong> active herd{herds.length === 1 ? '' : 's'}
            </span>
            {searchQuery && (
              <span className="text-emerald-700 font-semibold">Filtered by &ldquo;{searchQuery}&rdquo;</span>
            )}
          </div>
        </div>

        {/* Herd List Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 overscroll-contain bg-slate-50/30">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="size-6 animate-spin text-emerald-600" />
              <span className="text-xs font-bold">Loading active herds & batches...</span>
            </div>
          ) : isError ? (
            <div className="py-10 text-center space-y-2.5 px-4">
              <AlertCircle className="size-8 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">Could not retrieve herds for this barangay.</p>
                {errorMessage && (
                  <p className="text-[11px] text-rose-600 font-medium max-w-sm mx-auto leading-relaxed">{errorMessage}</p>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="text-xs rounded-xl border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Retry
              </Button>
            </div>
          ) : filteredHerds.length === 0 ? (
            <div className="py-12 text-center space-y-1.5 text-slate-500">
              <TrendingUp className="size-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                {searchQuery || selectedSpecies !== 'ALL'
                  ? 'No herds match your search or filter.'
                  : 'No active herds or batches recorded in this barangay.'}
              </p>
              <p className="text-[11px] text-slate-400">
                {searchQuery
                  ? 'Try adjusting your search criteria.'
                  : 'Herds can be established in the livestock inventory module.'}
              </p>
            </div>
          ) : (
            filteredHerds.map((herd) => {
              const headCount =
                herd.active_animal_count ?? herd.total_animals ?? herd.enrolled_animals ?? 0;
              const photo = herd.photo_url || herd.photo;

              return (
                <div
                  key={herd.id}
                  className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all space-y-2.5"
                >
                  {/* Top Row: Name, Species & Review Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2.5">
                      {photo ? (
                        <div className="size-11 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                          <img src={photo} alt={herd.batch_name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="size-10 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 border border-emerald-200 text-base flex items-center justify-center shrink-0 shadow-2xs">
                          {getSpeciesEmoji(herd.livestock_type_name)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900 leading-snug">
                            {herd.batch_name}
                          </h4>
                          <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            {herd.batch_code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <User className="size-3 text-slate-400 shrink-0" />
                          <span>Raiser: <strong className="text-slate-700">{herd.farmer_name || 'Registered Raiser'}</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {getReviewBadge(herd.review_status)}
                    </div>
                  </div>

                  {/* Metrics & Details Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs">
                    <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                        Active Heads
                      </span>
                      <span className="font-mono font-black text-slate-800 text-xs">
                        {getSpeciesEmoji(herd.livestock_type_name)} {headCount} head{headCount === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                        Species
                      </span>
                      <span className="font-bold text-slate-800 text-xs truncate block">
                        {herd.livestock_type_name || 'Livestock'}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                        Housing Pen
                      </span>
                      <span className="font-mono text-slate-800 text-[11px] truncate flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400 shrink-0" />
                        {herd.housing_pen || 'Standard Barn'}
                      </span>
                    </div>

                    <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                        Registered
                      </span>
                      <span className="font-mono text-slate-800 text-[11px] truncate flex items-center gap-1">
                        <Calendar className="size-3 text-slate-400 shrink-0" />
                        {formatDate(herd.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-medium">
            Municipal Agriculture Office • Padre Garcia, Batangas
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-xl border-slate-200 text-xs font-bold cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
