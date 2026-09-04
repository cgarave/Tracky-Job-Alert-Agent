"use client";

import React, { useState, useEffect } from "react";
import { DaemonSettings, AlertRecipient } from "@/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Settings,
  MessageSquare,
  Send,
  Save,
  Clock,
  MapPin,
  Sliders,
  Power,
  RefreshCw,
  Plus,
  X,
  Tag,
  Trash2,
  Edit3,
  Bot,
  Info,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Users,
} from "lucide-react";
import { testNotification } from "@/lib/api";
import { toast } from "sonner";

interface SettingsTabProps {
  settings: DaemonSettings;
  onSaveSettings: (settings: DaemonSettings) => Promise<void>;
  isLoading: boolean;
}

export function SettingsTab({
  settings,
  onSaveSettings,
  isLoading,
}: SettingsTabProps) {
  const [formData, setFormData] = useState<DaemonSettings>(settings);
  const [globalKeywordInput, setGlobalKeywordInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Recipient Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalRecipient, setModalRecipient] = useState<AlertRecipient>({
    id: "",
    name: "",
    platform: "imessage",
    destination: "",
    keywords: [],
    enabled: true,
  });
  const [modalKeywordInput, setModalKeywordInput] = useState("");

  // Testing states
  const [testingRecipientId, setTestingRecipientId] = useState<string | null>(null);

  useEffect(() => {
    // Normalize recipients from legacy or current settings
    const existingRecipients = settings.recipients || [];
    if (existingRecipients.length === 0 && settings.recipient) {
      const parts = settings.recipient.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
      const migrated: AlertRecipient[] = parts.map((dest, i) => ({
        id: `rec_${i + 1}`,
        name: `Recipient ${i + 1}`,
        platform: "imessage",
        destination: dest,
        keywords: settings.keywords || [],
        enabled: true,
      }));
      setFormData({
        ...settings,
        recipients: migrated,
      });
    } else {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // -------------------------------------------------------------------------
  // Global Keywords Handlers
  // -------------------------------------------------------------------------
  const handleAddGlobalKeyword = (rawText?: string) => {
    const textToAdd = rawText !== undefined ? rawText : globalKeywordInput;
    if (!textToAdd.trim()) return;

    const tokens = textToAdd
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const currentKeywords = formData.keywords || [];
    const lowerExisting = new Set(currentKeywords.map((k) => k.toLowerCase()));
    const newKeywords = [...currentKeywords];

    for (const token of tokens) {
      if (!lowerExisting.has(token.toLowerCase())) {
        newKeywords.push(token);
        lowerExisting.add(token.toLowerCase());
      }
    }

    handleChange("keywords", newKeywords);
    setGlobalKeywordInput("");
  };

  const handleRemoveGlobalKeyword = (indexToRemove: number) => {
    const nextKeywords = (formData.keywords || []).filter((_, idx) => idx !== indexToRemove);
    handleChange("keywords", nextKeywords);
  };

  // -------------------------------------------------------------------------
  // Recipient Modal & Management
  // -------------------------------------------------------------------------
  const openAddRecipientModal = () => {
    setEditingIndex(null);
    setModalRecipient({
      id: `rec_${Date.now()}`,
      name: "",
      platform: "imessage",
      destination: "",
      keywords: [],
      enabled: true,
    });
    setModalKeywordInput("");
    setIsModalOpen(true);
  };

  const openEditRecipientModal = (index: number) => {
    const target = (formData.recipients || [])[index];
    if (!target) return;
    setEditingIndex(index);
    setModalRecipient({ ...target, keywords: [...(target.keywords || [])] });
    setModalKeywordInput("");
    setIsModalOpen(true);
  };

  const handleModalAddKeyword = (rawText?: string) => {
    const textToAdd = rawText !== undefined ? rawText : modalKeywordInput;
    if (!textToAdd.trim()) return;

    const tokens = textToAdd
      .split(/[,;\n]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const currentKeywords = modalRecipient.keywords || [];
    const lowerExisting = new Set(currentKeywords.map((k) => k.toLowerCase()));
    const newKeywords = [...currentKeywords];

    for (const token of tokens) {
      if (!lowerExisting.has(token.toLowerCase())) {
        newKeywords.push(token);
        lowerExisting.add(token.toLowerCase());
      }
    }

    setModalRecipient((prev) => ({ ...prev, keywords: newKeywords }));
    setModalKeywordInput("");
  };

  const handleModalRemoveKeyword = (indexToRemove: number) => {
    setModalRecipient((prev) => ({
      ...prev,
      keywords: (prev.keywords || []).filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const handleSaveModalRecipient = async () => {
    if (!modalRecipient.name.trim()) {
      toast.error("Please enter a recipient name.");
      return;
    }
    if (!modalRecipient.destination.trim()) {
      toast.error(
        modalRecipient.platform === "telegram"
          ? "Please enter a Telegram Chat ID."
          : "Please enter an iMessage phone number or Apple ID email."
      );
      return;
    }

    // Flush any pending text in modalKeywordInput
    let finalKeywords = [...(modalRecipient.keywords || [])];
    if (modalKeywordInput.trim()) {
      const tokens = modalKeywordInput
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const lowerExisting = new Set(finalKeywords.map((k) => k.toLowerCase()));
      for (const token of tokens) {
        if (!lowerExisting.has(token.toLowerCase())) {
          finalKeywords.push(token);
          lowerExisting.add(token.toLowerCase());
        }
      }
    }

    const savedRecipient: AlertRecipient = {
      ...modalRecipient,
      keywords: finalKeywords,
    };

    const currentList = [...(formData.recipients || [])];
    if (editingIndex !== null) {
      currentList[editingIndex] = savedRecipient;
    } else {
      currentList.push(savedRecipient);
    }

    const updatedFormData: DaemonSettings = {
      ...formData,
      recipients: currentList,
    };

    setFormData(updatedFormData);
    setIsModalOpen(false);
    setModalKeywordInput("");

    try {
      await onSaveSettings(updatedFormData);
      toast.success(editingIndex !== null ? "Recipient updated and saved." : "Recipient added and saved.");
    } catch {
      toast.error("Failed to save recipient to backend.");
    }
  };

  const handleDeleteRecipient = async (index: number) => {
    const nextList = (formData.recipients || []).filter((_, idx) => idx !== index);
    const updatedFormData: DaemonSettings = {
      ...formData,
      recipients: nextList,
    };
    setFormData(updatedFormData);

    try {
      await onSaveSettings(updatedFormData);
      toast.success("Recipient removed.");
    } catch {
      toast.error("Failed to remove recipient on backend.");
    }
  };

  const handleToggleRecipient = async (index: number, enabled: boolean) => {
    const nextList = [...(formData.recipients || [])];
    if (nextList[index]) {
      nextList[index] = { ...nextList[index], enabled };
      const updatedFormData: DaemonSettings = {
        ...formData,
        recipients: nextList,
      };
      setFormData(updatedFormData);

      try {
        await onSaveSettings(updatedFormData);
        toast.success(enabled ? "Recipient enabled." : "Recipient disabled.");
      } catch {
        toast.error("Failed to update recipient state on backend.");
      }
    }
  };

  const handleTestNotification = async (recipient: AlertRecipient) => {
    if (!recipient.destination.trim()) {
      toast.error("Recipient has no destination configured.");
      return;
    }
    if (recipient.platform === "telegram" && !formData.telegram_bot_token?.trim()) {
      toast.error("Please configure and save your Telegram Bot Token first.");
      return;
    }

    setTestingRecipientId(recipient.id);
    try {
      const res = await testNotification({
        platform: recipient.platform,
        destination: recipient.destination,
        bot_token: formData.telegram_bot_token,
      });
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message || "Failed to deliver test notification.");
      }
    } catch (err: any) {
      toast.error(err.message || "Test delivery failed. Check network or credentials.");
    } finally {
      setTestingRecipientId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Form Submit
  // -------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    let finalKeywords = [...(formData.keywords || [])];
    if (globalKeywordInput.trim()) {
      const tokens = globalKeywordInput
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const lowerExisting = new Set(finalKeywords.map((k) => k.toLowerCase()));
      for (const token of tokens) {
        if (!lowerExisting.has(token.toLowerCase())) {
          finalKeywords.push(token);
          lowerExisting.add(token.toLowerCase());
        }
      }
      setGlobalKeywordInput("");
    }

    const updatedFormData = {
      ...formData,
      keywords: finalKeywords,
    };
    setFormData(updatedFormData);

    try {
      await onSaveSettings(updatedFormData);
      toast.success("Settings saved successfully!");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const globalKeywords = formData.keywords || [];
  const recipients = formData.recipients || [];

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Card 1: Alert Recipients & Notification Channels */}
        <Card className="bg-white border-slate-200/90 shadow-xs">
          <CardHeader className="flex flex-row items-start justify-between pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                  Alert Channels & Recipients
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-slate-500 mt-1">
                Configure delivery destinations (iMessage or Telegram) and target keywords per recipient.
              </CardDescription>
            </div>
            <Button
              type="button"
              onClick={openAddRecipientModal}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-3.5 h-8 shadow-2xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Recipient</span>
            </Button>
          </CardHeader>

          <CardContent className="pt-0 flex flex-col gap-4">
            {recipients.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                <Users className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-xs font-semibold text-slate-700">No alert recipients configured</p>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm">
                  Add an iMessage contact or Telegram Chat ID to start receiving matching job alerts.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openAddRecipientModal}
                  className="mt-3 gap-1.5 text-xs h-8 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Configure First Recipient</span>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recipients.map((rec, idx) => {
                  const isTesting = testingRecipientId === rec.id;
                  const isTelegram = rec.platform === "telegram";
                  const hasCustomKeywords = (rec.keywords || []).length > 0;

                  return (
                    <div
                      key={rec.id || `rec-${idx}`}
                      className={`flex flex-col md:flex-row md:items-center justify-between p-3.5 rounded-xl border transition-all ${
                        rec.enabled
                          ? "bg-slate-50/70 border-slate-200 hover:border-slate-300"
                          : "bg-slate-100/50 border-slate-200 opacity-65"
                      }`}
                    >
                      {/* Left: Recipient Details */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${
                            isTelegram
                              ? "bg-sky-50 border-sky-200 text-sky-600"
                              : "bg-blue-50 border-blue-200 text-blue-600"
                          }`}
                        >
                          {isTelegram ? <Send className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                        </div>

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {rec.name || "Unnamed Recipient"}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono px-2 py-0.5 border ${
                                isTelegram
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {isTelegram ? "Telegram" : "iMessage"}
                            </Badge>
                            {!rec.enabled && (
                              <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-100 border-slate-200">
                                Inactive
                              </Badge>
                            )}
                          </div>

                          <span className="text-[11px] font-mono text-slate-600 mt-0.5 break-all">
                            {rec.destination || "No destination configured"}
                          </span>

                          {/* Recipient Keywords Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {hasCustomKeywords ? (
                              rec.keywords.map((kw, kwIdx) => (
                                <span
                                  key={`${kw}-${kwIdx}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[10px] font-medium"
                                >
                                  <Tag className="w-2.5 h-2.5 text-blue-600" />
                                  <span>{kw}</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">
                                Receives all tracked jobs (no keyword filter)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 mt-3 md:mt-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/80 justify-end shrink-0">
                        {/* Test Button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isTesting || !rec.enabled}
                          onClick={() => handleTestNotification(rec)}
                          className="h-7 px-2.5 text-[11px] font-medium bg-white hover:bg-slate-50 border-slate-200 text-slate-700 cursor-pointer"
                          title="Send a live test alert to this recipient"
                        >
                          {isTesting ? (
                            <RefreshCw className="w-3 h-3 animate-spin text-blue-600 mr-1" />
                          ) : (
                            <Send className="w-3 h-3 text-slate-500 mr-1" />
                          )}
                          <span>{isTesting ? "Testing..." : "Test"}</span>
                        </Button>

                        {/* Edit Button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditRecipientModal(idx)}
                          className="h-7 w-7 p-0 bg-white hover:bg-slate-50 border-slate-200 text-slate-600 cursor-pointer"
                          title="Edit recipient settings"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>

                        {/* Delete Button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteRecipient(idx)}
                          className="h-7 w-7 p-0 bg-white hover:bg-rose-50 border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 cursor-pointer"
                          title="Remove recipient"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>

                        {/* Enable/Disable Switch */}
                        <div className="flex items-center pl-1">
                          <Switch
                            checked={rec.enabled}
                            onCheckedChange={(checked) => handleToggleRecipient(idx, checked)}
                            title={rec.enabled ? "Disable alerts for this recipient" : "Enable alerts for this recipient"}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Telegram Bot Integration */}
        <Card className="bg-white border-slate-200/90 shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-sky-600" />
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                Telegram Bot API Gateway
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Connect your central Telegram Bot to dispatch corporate, zero-emoji HTML notifications to Telegram recipients.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telegram_token" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-sky-600" />
                  <span>Central Bot Token (from @BotFather)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Format: 123456:ABC-DEF...</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="telegram_token"
                  type="text"
                  value={formData.telegram_bot_token || ""}
                  onChange={(e) => handleChange("telegram_bot_token", e.target.value)}
                  className="bg-white border-slate-200 text-xs font-mono text-slate-900 placeholder:text-slate-400 flex-1"
                  placeholder="Paste token from @BotFather (e.g. 7123456789:AAFxxx...)"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!formData.telegram_bot_token?.trim()) {
                      toast.error("Please paste a Bot Token first.");
                      return;
                    }
                    try {
                      await onSaveSettings(formData);
                      toast.success("Telegram Bot Token saved.");
                    } catch {
                      toast.error("Failed to save Bot Token.");
                    }
                  }}
                  className="h-9 px-3 text-xs bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200 cursor-pointer shrink-0 font-medium"
                >
                  Save Token
                </Button>
              </div>
            </div>

            {/* Telegram Setup Quick Guide */}
            <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-200/70 text-xs text-slate-700">
              <div className="flex items-center gap-1.5 font-semibold text-sky-900 mb-1.5">
                <Info className="w-4 h-4 text-sky-600" />
                <span>Quick Setup Guide for Telegram</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                <li>
                  Open <span className="font-semibold text-sky-800">@BotFather</span> in Telegram, send <code className="bg-white px-1 py-0.5 rounded border border-sky-200 font-mono text-[10px]">/newbot</code>, and copy your HTTP API token here.
                </li>
                <li>
                  Recipients can get their numerical Chat ID by sending <code className="bg-white px-1 py-0.5 rounded border border-sky-200 font-mono text-[10px]">/start</code> to <span className="font-semibold text-sky-800">@userinfobot</span>.
                </li>
                <li>
                  Each recipient must press <span className="font-semibold text-sky-800">Start</span> in your bot before Tracky can deliver alerts.
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Search & Daemon Configuration */}
        <Card className="bg-white border-slate-200/90 shadow-xs">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base font-bold text-slate-900 tracking-tight">
                Search Engine & Crawler Settings
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-1">
              Configure scraping intervals, geographic location, and global fallback keywords.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Global Keyword Badges / Pills Input */}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="global-keyword-input" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    <span>Global Search Keywords (All Boards)</span>
                  </div>
                  <span className="text-[11px] text-blue-700 font-mono font-medium">
                    {globalKeywords.length} active keyword{globalKeywords.length === 1 ? "" : "s"}
                  </span>
                </Label>

                {/* Tag / Pill Box */}
                <div className="flex flex-wrap items-center gap-2 p-2.5 min-h-[46px] rounded-xl bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  {globalKeywords.map((kw, idx) => (
                    <span
                      key={`${kw}-${idx}`}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium group transition-all hover:border-blue-300"
                    >
                      <Tag className="w-3 h-3 text-blue-600 shrink-0" />
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGlobalKeyword(idx)}
                        className="p-0.5 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                        title={`Remove "${kw}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                    <input
                      id="global-keyword-input"
                      type="text"
                      value={globalKeywordInput}
                      onChange={(e) => setGlobalKeywordInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddGlobalKeyword();
                        } else if (e.key === "Backspace" && !globalKeywordInput && globalKeywords.length > 0) {
                          e.preventDefault();
                          handleRemoveGlobalKeyword(globalKeywords.length - 1);
                        }
                      }}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData("text");
                        if (pasted.includes(",") || pasted.includes("\n") || pasted.includes(";")) {
                          e.preventDefault();
                          handleAddGlobalKeyword(pasted);
                        }
                      }}
                      placeholder={
                        globalKeywords.length === 0
                          ? "Type a keyword and press Enter (e.g. Full Stack Developer)..."
                          : "Add keyword + Enter..."
                      }
                      className="flex-1 bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none px-1 py-1"
                    />

                    {globalKeywordInput.trim() && (
                      <button
                        type="button"
                        onClick={() => handleAddGlobalKeyword()}
                        className="h-6 px-2 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-1 shrink-0 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-500">
                  Tracky automatically scrapes the union of all global keywords and recipient-specific keywords across Indeed, JobStreet, OnlineJobs, and LinkedIn.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="location" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>Search Location</span>
                </Label>
                <Input
                  id="location"
                  value={formData.location || "Philippines"}
                  onChange={(e) => handleChange("location", e.target.value)}
                  className="bg-white border-slate-200 text-xs text-slate-900"
                  placeholder="e.g. Philippines, Remote"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="check_interval" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Scrape Interval (minutes)</span>
                </Label>
                <Input
                  id="check_interval"
                  type="number"
                  min={5}
                  max={1440}
                  value={formData.check_interval_minutes ?? 60}
                  onChange={(e) => handleChange("check_interval_minutes", parseInt(e.target.value) || 60)}
                  className="bg-white border-slate-200 text-xs text-slate-900"
                />
              </div>

              {/* Daemon State Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2 mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-200/80">
                    <Power className={`w-4 h-4 ${formData.paused ? "text-amber-600" : "text-emerald-600"}`} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 block">Scanner Daemon Status</span>
                    <span className="text-[11px] text-slate-500">
                      {formData.paused ? "Paused — background scanning is inactive" : "Active — periodically discovering new jobs"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 font-medium">
                    {formData.paused ? "Paused" : "Active"}
                  </span>
                  <Switch
                    checked={!formData.paused}
                    onCheckedChange={(checked) => handleChange("paused", !checked)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Bar */}
        <div className="flex items-center justify-end">
          <Button
            type="submit"
            disabled={isSaving || isLoading}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs px-5 shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? "Saving..." : "Save All Settings"}</span>
          </Button>
        </div>
      </form>

      {/* Add / Edit Recipient Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-200 shadow-xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>{editingIndex !== null ? "Edit Alert Recipient" : "Add Alert Recipient"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure alert destination channel and custom keyword filters for this recipient.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Recipient Name */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modal-name" className="text-xs font-semibold text-slate-700">
                Recipient Name / Label
              </Label>
              <Input
                id="modal-name"
                value={modalRecipient.name}
                onChange={(e) => setModalRecipient((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. My iPhone, Alex Telegram, Design Lead"
                className="bg-white border-slate-200 text-xs text-slate-900"
              />
            </div>

            {/* Platform Selection */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-700">Delivery Channel</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalRecipient((prev) => ({ ...prev, platform: "imessage" }))}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    modalRecipient.platform === "imessage"
                      ? "bg-blue-50 border-blue-500 text-blue-700 font-semibold ring-1 ring-blue-500"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                  <span>iMessage</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalRecipient((prev) => ({ ...prev, platform: "telegram" }))}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                    modalRecipient.platform === "telegram"
                      ? "bg-sky-50 border-sky-500 text-sky-700 font-semibold ring-1 ring-sky-500"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Send className="w-3.5 h-3.5 text-sky-600" />
                  <span>Telegram</span>
                </button>
              </div>
            </div>

            {/* Destination Address / Chat ID */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modal-dest" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>{modalRecipient.platform === "telegram" ? "Telegram Chat ID" : "Phone Number or Apple ID"}</span>
                {modalRecipient.platform === "telegram" && (
                  <span className="text-[10px] text-slate-500 font-mono">From @userinfobot</span>
                )}
              </Label>
              <Input
                id="modal-dest"
                value={modalRecipient.destination}
                onChange={(e) => setModalRecipient((prev) => ({ ...prev, destination: e.target.value }))}
                placeholder={
                  modalRecipient.platform === "telegram"
                    ? "e.g. 123456789 (or -100123456789 for group)"
                    : "e.g. user@icloud.com or +639171234567"
                }
                className="bg-white border-slate-200 text-xs font-mono text-slate-900"
              />
            </div>

            {/* Per-Recipient Custom Keywords */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Custom Target Keywords (Optional)</span>
                <span className="text-[10px] text-slate-500">
                  {(modalRecipient.keywords || []).length} keywords
                </span>
              </Label>

              <div className="flex flex-wrap items-center gap-1.5 p-2 min-h-[40px] rounded-lg bg-slate-50 border border-slate-200 focus-within:bg-white focus-within:border-blue-500 transition-all">
                {(modalRecipient.keywords || []).map((kw, idx) => (
                  <span
                    key={`${kw}-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-medium"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleModalRemoveKeyword(idx)}
                      className="text-blue-600 hover:text-blue-900 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}

                <input
                  type="text"
                  value={modalKeywordInput}
                  onChange={(e) => setModalKeywordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleModalAddKeyword();
                    } else if (e.key === "Backspace" && !modalKeywordInput && (modalRecipient.keywords || []).length > 0) {
                      e.preventDefault();
                      handleModalRemoveKeyword((modalRecipient.keywords || []).length - 1);
                    }
                  }}
                  placeholder={
                    (modalRecipient.keywords || []).length === 0
                      ? "e.g. frontend, react, ui/ux (Leave blank for all jobs)"
                      : "Add keyword..."
                  }
                  className="flex-1 min-w-[140px] bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none px-1 py-0.5"
                />
              </div>

              <p className="text-[10px] text-slate-500">
                If left empty, this recipient will receive all discovered jobs. If keywords are added, they will only receive jobs matching their terms.
              </p>
            </div>

            {/* Enabled Switch */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 mt-1">
              <span className="text-xs font-medium text-slate-700">Enable Alert Delivery</span>
              <Switch
                checked={modalRecipient.enabled}
                onCheckedChange={(checked) => setModalRecipient((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="text-xs h-8 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveModalRecipient}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white font-medium cursor-pointer shadow-2xs"
            >
              {editingIndex !== null ? "Save Changes" : "Add Recipient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
