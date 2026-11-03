"use client";

import { PageHeader } from "@/app/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Clock3, Loader2, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type SettingChange = {
  setting_name: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
};

type SystemSettings = {
  browser_push_enabled: boolean;
  updated_at: string | null;
  updated_by: string | null;
  recent_changes: SettingChange[];
};

export default function SystemSettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery<SystemSettings>({
    queryKey: ["system-settings"],
    queryFn: async () => (await api.get("/api/users/system-settings/")).data,
  });

  const updateMutation = useMutation({
    mutationFn: async (browserPushEnabled: boolean) =>
      (await api.patch("/api/users/system-settings/", { browser_push_enabled: browserPushEnabled })).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("System setting saved.");
    },
    onError: () => toast.error("Could not save this setting."),
  });

  const settings = settingsQuery.data;

  return (
    <main className="flex-1 min-w-0 pb-12">
      <PageHeader
        title="System Settings"
        subtitle="Manage municipality-wide options for SmartLivestock."
        icon={<Settings2 className="size-5" />}
        variant="admin"
        showBreadcrumbs
      />

      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" />
          <p>These settings apply across the system. Changes are restricted to MAO and Admin accounts and are recorded below.</p>
        </div>

        {settingsQuery.isLoading ? (
          <div className="flex min-h-40 items-center justify-center text-slate-500"><Loader2 className="mr-2 size-5 animate-spin" />Loading settings…</div>
        ) : settingsQuery.isError ? (
          <Card><CardContent className="py-8 text-sm text-rose-700">Settings could not be loaded. Refresh the page and try again.</CardContent></Card>
        ) : settings ? (
          <>
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><Bell className="size-5" /></span>
                  <div>
                    <CardTitle className="text-base">Browser push notifications</CardTitle>
                    <CardDescription className="mt-1">Controls whether SmartLivestock offers and sends notifications to subscribed browsers.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Badge className={settings.browser_push_enabled ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
                    {settings.browser_push_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  <span className="text-xs text-slate-500">In-app notifications remain available either way.</span>
                </div>
                <Button
                  type="button"
                  variant={settings.browser_push_enabled ? "outline" : "default"}
                  disabled={updateMutation.isPending}
                  onClick={() => updateMutation.mutate(!settings.browser_push_enabled)}
                  className="min-w-36"
                >
                  {updateMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                  {settings.browser_push_enabled ? "Turn off push" : "Turn on push"}
                </Button>
              </CardContent>
              {settings.updated_at && (
                <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
                  Last changed by {settings.updated_by || "system"} · {new Date(settings.updated_at).toLocaleString()}
                </div>
              )}
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2"><Clock3 className="size-4 text-slate-500" /><CardTitle className="text-base">Recent changes</CardTitle></div>
                <CardDescription>Recent system setting updates and the staff account that made them.</CardDescription>
              </CardHeader>
              <CardContent>
                {settings.recent_changes.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No setting changes have been recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {settings.recent_changes.map((change, index) => (
                      <div key={`${change.setting_name}-${change.changed_at}-${index}`} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-slate-800">Browser push: <span className="font-semibold">{change.old_value} → {change.new_value}</span></p>
                        <p className="text-xs text-slate-500">{change.changed_by} · {new Date(change.changed_at).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </main>
  );
}
