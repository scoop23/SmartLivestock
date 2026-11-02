"use client";

import { useState, type FormEvent } from "react";
import { Building2, Mail, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BarangayItem } from "../admin/admin-charts";
import { useCreateStaffInvitation, type StaffInvitationPayload } from "./user-management";

interface StaffInvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  barangays: BarangayItem[];
  barangaysLoading: boolean;
  barangaysError: boolean;
  onRetryBarangays: () => void;
}

const initialForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  role: "" as StaffInvitationPayload["role"] | "",
  assigned_barangay_id: "",
};

export function StaffInvitationDialog({
  open,
  onOpenChange,
  barangays,
  barangaysLoading,
  barangaysError,
  onRetryBarangays,
}: StaffInvitationDialogProps) {
  const [form, setForm] = useState(initialForm);
  const createInvitation = useCreateStaffInvitation();
  const isCbat = form.role === "CBAT";

  const handleOpenChange = (nextOpen: boolean) => {
    if (createInvitation.isPending) return;
    if (!nextOpen) setForm(initialForm);
    onOpenChange(nextOpen);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.role) return;
    const payload: StaffInvitationPayload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim() || undefined,
      role: form.role,
      ...(isCbat ? { assigned_barangay_id: Number(form.assigned_barangay_id) } : {}),
    };
    createInvitation.mutate(payload, { onSuccess: () => { setForm(initialForm); onOpenChange(false); } });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-2xl p-4 sm:p-6">
        <DialogHeader className="text-left">
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900">
            <UserPlus className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold text-slate-900">Invite staff member</DialogTitle>
          <DialogDescription className="leading-5">
            Choose the staff role and send a one-time password setup link to their email.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-700" />
          <p className="leading-5">They can set their password from the invitation. Their account stays pending until MAO approves it.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-first-name">First name</Label>
              <Input id="staff-first-name" autoComplete="given-name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-last-name">Last name</Label>
              <Input id="staff-last-name" autoComplete="family-name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required maxLength={150} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="staff-email">Work email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input id="staff-email" className="pl-9" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <p className="text-xs text-slate-500">The setup link will be sent to this address.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-phone">Phone number <span className="font-normal text-slate-500">(optional)</span></Label>
              <Input id="staff-phone" type="tel" autoComplete="tel" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-role">Staff role</Label>
              <Select value={form.role} onValueChange={(role) => setForm({ ...form, role: role as StaffInvitationPayload["role"], assigned_barangay_id: "" })}>
                <SelectTrigger id="staff-role" aria-label="Choose staff role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBAT">CBAT reviewer</SelectItem>
                  <SelectItem value="AUCTION">Auction staff</SelectItem>
                  <SelectItem value="SLAUGHTERHOUSESTAFF">Slaughterhouse staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCbat && (
            <div className="space-y-1.5">
              <Label htmlFor="staff-barangay">Assigned barangay</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Select value={form.assigned_barangay_id} onValueChange={(assigned_barangay_id) => setForm({ ...form, assigned_barangay_id })} disabled={barangaysLoading || barangaysError}>
                  <SelectTrigger id="staff-barangay" className="pl-9" aria-label="Assign CBAT barangay"><SelectValue placeholder={barangaysLoading ? "Loading barangays…" : "Choose a barangay"} /></SelectTrigger>
                  <SelectContent>
                    {barangays.map((barangay) => <SelectItem key={barangay.id} value={String(barangay.id)}>{barangay.barangay_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {barangaysError && <p role="alert" className="text-xs text-rose-700">Barangays could not be loaded. <button type="button" onClick={onRetryBarangays} className="font-semibold underline">Retry</button></p>}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createInvitation.isPending} className="min-h-11">Cancel</Button>
            <Button type="submit" disabled={!form.role || createInvitation.isPending || (isCbat && (!form.assigned_barangay_id || barangaysLoading || barangaysError))} className="min-h-11 bg-emerald-800 text-white hover:bg-emerald-900">
              {createInvitation.isPending ? "Sending invitation…" : "Create account & send invite"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
