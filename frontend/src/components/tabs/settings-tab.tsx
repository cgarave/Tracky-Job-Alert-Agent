"use client";

import React, { useState } from "react";
import { DaemonSettings } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";

interface SettingsTabProps {
  settings: DaemonSettings;
  onSaveSettings: (s: DaemonSettings) => Promise<void>;
  isSaving: boolean;
}

export function SettingsTab({ settings, onSaveSettings, isSaving }: SettingsTabProps) {
  const [keywordsText, setKeywordsText] = useState((settings.keywords || []).join("\n"));
  const [location, setLocation] = useState(settings.location || "Philippines");
  const [interval, setIntervalVal] = useState(settings.check_interval_minutes || 60);
  const [recipient, setRecipient] = useState(settings.recipient || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const keywordsList = keywordsText
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    const updated: DaemonSettings = {
      ...settings,
      keywords: keywordsList,
      location,
      check_interval_minutes: interval,
      recipient,
    };

    await onSaveSettings(updated);
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="text-base">⚙️ Search & Daemon Configuration</CardTitle>
        <CardDescription className="text-xs">
          Configure search queries, background scraping interval, and your iPhone iMessage recipient.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="keywords">Job Search Keywords (One per line)</Label>
            <Textarea
              id="keywords"
              rows={5}
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="software engineer&#10;frontend developer&#10;react developer"
            />
            <span className="text-[11px] text-slate-500">
              Each keyword is queried against Indeed.ph, JobStreet.ph, and OnlineJobs.ph.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Search Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Philippines or Remote"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="interval">Scrape Interval (Minutes)</Label>
              <Input
                id="interval"
                type="number"
                min="5"
                value={interval}
                onChange={(e) => setIntervalVal(parseInt(e.target.value) || 60)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recipient">iMessage Alert Recipient (Phone number or Apple ID email)</Label>
            <Input
              id="recipient"
              placeholder="+639171234567 or user@icloud.com"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <span className="text-[11px] text-slate-500">
              Job alerts and 1-click apply commands are delivered directly to this iMessage address.
            </span>
          </div>

          <Button type="submit" disabled={isSaving} className="self-end gap-2 mt-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Daemon Settings</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
