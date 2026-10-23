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
  Users,
  Search,
  X,
  Phone,
  MapPin,
  Calendar,
  Tag,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export interface BarangayFarmerItem {
  id: number;
  barangay: number;
  barangay_name: string;
  farmer_name: string;
  farm_size?: string | number | null;
  address?: string | null;
  registered_at?: string | null;
  rsbsa_number?: string | null;
  contact_number?: string | null;
  active_herds_count?: number;
  animals_count?: number;
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

interface BarangayFarmersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barangayName: string;
  barangayId: number | null;
}

export function BarangayFarmersDialog({
  open,
  onOpenChange,
  barangayName,
  barangayId,
}: BarangayFarmersDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedKey = (barangayName || '').trim().toLowerCase();
  const resolvedId = (barangayId && barangayId > 0) ? barangayId : (CANONICAL_BARANGAYS[normalizedKey] || 0);

  const {
    data: farmers = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<BarangayFarmerItem[]>({
    queryKey: ['barangay-farmers', resolvedId, barangayName],
    queryFn: async () => {
      const endpoint =
        resolvedId > 0
          ? `livestock/farmers/${resolvedId}/?barangay_name=${encodeURIComponent(barangayName)}`
          : `livestock/farmers/0/?barangay_name=${encodeURIComponent(barangayName)}`;
      const res = await api.get(endpoint);
      return Array.isArray(res.data) ? res.data : [];
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
      if (error.response?.status === 403) return 'You do not have permission to view registered farmers.';
      if (error.response?.status === 404) return 'Barangay records could not be found.';
      return error.message;
    }
    if (error instanceof Error) return error.message;
    return 'Could not retrieve registered farmers.';
  }, [error]);

  const filteredFarmers = useMemo(() => {
    if (!searchQuery.trim()) return farmers;
    const q = searchQuery.toLowerCase().trim();
    return farmers.filter(
      (f) =>
        f.farmer_name.toLowerCase().includes(q) ||
        (f.rsbsa_number && f.rsbsa_number.toLowerCase().includes(q)) ||
        (f.address && f.address.toLowerCase().includes(q)) ||
        (f.contact_number && f.contact_number.toLowerCase().includes(q))
    );
  }, [farmers, searchQuery]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Registered';
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
              <Users className="size-5 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                  Registered Farmers
                </DialogTitle>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-xs">
                  Brgy. {barangayName}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-500 font-medium mt-0.5">
                Official agricultural livestock raisers registered in Padre Garcia
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

        {/* Search Bar & Counter */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-slate-50/70 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by farmer name, RSBSA number, contact, or purok..."
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
              title="Refresh farmer list"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin text-emerald-600' : ''}`} />
            </Button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-0.5">
            <span>
              Showing <strong className="text-slate-800">{filteredFarmers.length}</strong> of{' '}
              <strong className="text-slate-800">{farmers.length}</strong> registered farmer{farmers.length === 1 ? '' : 's'}
            </span>
            {searchQuery && (
              <span className="text-emerald-700 font-semibold">Filtered by &ldquo;{searchQuery}&rdquo;</span>
            )}
          </div>
        </div>

        {/* Farmer List Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 overscroll-contain bg-slate-50/30">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="size-6 animate-spin text-emerald-600" />
              <span className="text-xs font-bold">Loading registered farmers...</span>
            </div>
          ) : isError ? (
            <div className="py-10 text-center space-y-2.5 px-4">
              <AlertCircle className="size-8 text-rose-500 mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">Could not retrieve registered farmers.</p>
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
          ) : filteredFarmers.length === 0 ? (
            <div className="py-12 text-center space-y-1.5 text-slate-500">
              <Users className="size-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                {searchQuery ? 'No farmers match your search query.' : 'No registered farmers found in this barangay.'}
              </p>
              <p className="text-[11px] text-slate-400">
                {searchQuery
                  ? 'Try searching with a different name or RSBSA reference.'
                  : 'New livestock raisers can be enrolled via Farmer Registration.'}
              </p>
            </div>
          ) : (
            filteredFarmers.map((farmer) => (
              <div
                key={farmer.id}
                className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:border-emerald-300 transition-all space-y-2.5"
              >
                {/* Farmer Identity Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-gradient-to-br from-emerald-100 to-sky-100 border border-emerald-200 text-emerald-900 font-black text-xs flex items-center justify-center shrink-0 shadow-2xs">
                      {farmer.farmer_name
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || 'FR'}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 leading-snug truncate">
                        {farmer.farmer_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                        <MapPin className="size-3 text-slate-400 shrink-0" />
                        <span className="truncate">{farmer.address || `Brgy. ${barangayName}`}</span>
                      </p>
                    </div>
                  </div>

                  {farmer.rsbsa_number ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0 shadow-2xs">
                      <Tag className="size-3 text-emerald-700" />
                      RSBSA: {farmer.rsbsa_number}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono italic shrink-0">
                      No RSBSA
                    </span>
                  )}
                </div>

                {/* Metrics & Details Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Livestock
                    </span>
                    <span className="font-mono font-black text-slate-800 text-xs">
                      🐄 {farmer.animals_count ?? 0} head{farmer.animals_count === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Active Herds
                    </span>
                    <span className="font-mono font-black text-slate-800 text-xs">
                      🏷️ {farmer.active_herds_count ?? 0} batch{farmer.active_herds_count === 1 ? '' : 'es'}
                    </span>
                  </div>

                  <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Contact
                    </span>
                    <span className="font-mono text-slate-800 text-[11px] truncate flex items-center gap-1">
                      <Phone className="size-3 text-slate-400 shrink-0" />
                      {farmer.contact_number || 'N/A'}
                    </span>
                  </div>

                  <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                      Registered
                    </span>
                    <span className="font-mono text-slate-800 text-[11px] truncate flex items-center gap-1">
                      <Calendar className="size-3 text-slate-400 shrink-0" />
                      {formatDate(farmer.registered_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))
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
