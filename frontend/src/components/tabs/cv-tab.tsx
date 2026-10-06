"use client";

import { useEffect, useState } from "react";
import { FileUser, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { toast } from "sonner";

interface CVTabProps { onScoresChanged: () => void }

export function CVTab({ onScoresChanged }: CVTabProps) {
  const [profile, setProfile] = useState<api.CVSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

  const [geminiError, setGeminiError] = useState<string | null>(null);

  useEffect(() => { api.fetchCV().then(setProfile).catch((e) => setError(e.message)); }, []);

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const result = await api.uploadCV(file);
      setProfile(result); onScoresChanged();
      toast.success(`Scored ${result.scored_jobs || 0} jobs against your CV`);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not upload CV"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setError(null); setGeminiError(null);
    try { setProfile(await api.removeCV()); onScoresChanged(); toast.success("CV and fit scores removed"); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not remove CV"); }
    finally { setBusy(false); }
  };

  const analyzeWithGemini = async () => {
    setBusy(true); setGeminiError(null);
    try {
      const result = await api.analyzeCVWithGemini(apiKey.trim());
      setProfile(result); setApiKey(""); onScoresChanged();
      toast.success("Gemini analyzed your CV and updated job fit scores");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gemini analysis failed";
      setGeminiError(msg);
      toast.error(msg);
    }
    finally { setBusy(false); }
  };

  return <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex items-start gap-4"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><FileUser className="h-6 w-6" /></div><div><h2 className="text-lg font-semibold text-slate-900">Your CV and job fit</h2><p className="mt-1 text-sm text-slate-600">Upload your CV to score every tracked job. Your CV stays on this Mac. Scores are guidance, with matched and missing skills shown on each listing.</p></div></div>
    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
      <label htmlFor="cv-upload" className="block text-sm font-medium text-slate-800">{profile?.uploaded ? "Replace your CV" : "Upload your CV"}</label>
      <p className="mt-1 text-xs text-slate-500">PDF, DOCX, or TXT · up to 4 MiB · text-based documents only</p>
      <input id="cv-upload" type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} className="mt-4 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" />
      {busy && <p className="mt-3 flex items-center gap-2 text-sm text-blue-700"><Upload className="h-4 w-4" />Analyzing CV and scoring jobs…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
    {profile?.uploaded && <div className="mt-6"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{profile.filename}</p><p className="text-xs text-slate-500">{profile.skills?.length || 0} recognized skills · {profile.keyword_count || 0} profile terms · {profile.analysis === "gemini" ? "Gemini analyzed" : "Local analysis"}</p></div><Button variant="outline" size="sm" disabled={busy} onClick={() => void remove()}><Trash2 className="mr-2 h-4 w-4" />Remove CV</Button></div>{profile.summary && <p className="mt-3 text-sm text-slate-700">{profile.summary}</p>}<div className="mt-4 flex flex-wrap gap-2">{profile.skills?.map((skill) => <span key={skill} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-800">{skill}</span>)}</div><div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4"><label htmlFor="gemini-key" className="text-sm font-semibold text-slate-900">Analyze CV with Gemini</label><p className="mt-1 text-xs text-slate-600">This sends your extracted CV text to Google Gemini once. Your API key is used for this request and is not saved. Job descriptions remain on your Mac; job fit scores are calculated locally.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="gemini-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Gemini API key" className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600" /><Button disabled={busy || !apiKey.trim()} onClick={() => void analyzeWithGemini()}>Analyze with Gemini</Button></div>{geminiError && <p role="alert" className="mt-2 text-xs text-red-600">{geminiError}</p>}</div></div>}
  </section>;
}
