"use client";

import React, { useState } from "react";
import { UserProfile } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bot, Shield, Save, Loader2 } from "lucide-react";

interface AutoApplyTabProps {
  profile: UserProfile;
  onSaveProfile: (p: UserProfile) => Promise<void>;
  isSaving: boolean;
}

export function AutoApplyTab({ profile, onSaveProfile, isSaving }: AutoApplyTabProps) {
  const [autoApply, setAutoApply] = useState(profile.auto_apply);
  const [blacklistComp, setBlacklistComp] = useState(
    (profile.auto_apply.blacklisted_companies || []).join(", ")
  );
  const [blacklistKw, setBlacklistKw] = useState(
    (profile.auto_apply.blacklisted_keywords || []).join(", ")
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const compList = blacklistComp
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const kwList = blacklistKw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const updated: UserProfile = {
      ...profile,
      auto_apply: {
        ...autoApply,
        blacklisted_companies: compList,
        blacklisted_keywords: kwList,
      },
    };

    await onSaveProfile(updated);
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base">🤖 Autonomous Auto-Apply Guardrails</CardTitle>
              <CardDescription className="text-xs">
                Configure safety parameters and automatic submission rules.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-300">
              {autoApply.enabled ? (
                <span className="text-emerald-400">Active (Auto-Pilot)</span>
              ) : (
                <span className="text-slate-500">Disabled</span>
              )}
            </span>
            <Switch
              checked={autoApply.enabled}
              onCheckedChange={(val) =>
                setAutoApply((prev) => ({ ...prev, enabled: val }))
              }
            />
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 flex items-start gap-3">
            <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300 leading-relaxed">
              When enabled, Tracky automatically submits your authentic PDF resume to new job listings that match your criteria and support 1-click apply (*Indeed Easy Apply*, *JobStreet Quick Apply*, *OnlineJobs.ph*).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="daily_cap">Daily Application Cap</Label>
              <Input
                id="daily_cap"
                type="number"
                min="1"
                max="50"
                value={autoApply.daily_cap || 5}
                onChange={(e) =>
                  setAutoApply((prev) => ({
                    ...prev,
                    daily_cap: parseInt(e.target.value) || 5,
                  }))
                }
              />
              <span className="text-[11px] text-slate-500">
                Recommended: 5–15 per day to maintain account health.
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="match_score">Minimum Match Score (%)</Label>
              <Input
                id="match_score"
                type="number"
                min="50"
                max="100"
                value={autoApply.match_threshold || 75}
                onChange={(e) =>
                  setAutoApply((prev) => ({
                    ...prev,
                    match_threshold: parseInt(e.target.value) || 75,
                  }))
                }
              />
              <span className="text-[11px] text-slate-500">
                Only apply if keyword relevance exceeds this threshold.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="blacklist_comp">Blacklisted Companies (Comma-separated)</Label>
            <Input
              id="blacklist_comp"
              placeholder="e.g. SpamCorp, LowPay LLC, Unnamed Agency"
              value={blacklistComp}
              onChange={(e) => setBlacklistComp(e.target.value)}
            />
            <span className="text-[11px] text-slate-500">
              Tracky will never apply to jobs from these employers.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="blacklist_kw">Excluded Title Keywords (Comma-separated)</Label>
            <Input
              id="blacklist_kw"
              placeholder="e.g. unpaid, internship, 6-day workweek, graveyard"
              value={blacklistKw}
              onChange={(e) => setBlacklistKw(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={isSaving} className="self-end gap-2 mt-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Auto-Apply Rules</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
