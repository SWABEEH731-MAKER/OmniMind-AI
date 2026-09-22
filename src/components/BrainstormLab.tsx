import React, { useState } from 'react';
import { Sparkles, FileSpreadsheet, Loader2, ArrowRight, CheckCircle2, AlertCircle, Layers } from 'lucide-react';
import { IdeaItem } from '../types';
import { exportToGoogleSheets } from '../lib/workspace';

interface BrainstormLabProps {
  user: any;
  onLogin: () => void;
}

export const BrainstormLab: React.FC<BrainstormLabProps> = ({ user, onLogin }) => {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [ideasResult, setIdeasResult] = useState<{ topic: string; ideas: IdeaItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const presetTopics = [
    'AI-powered micro-SaaS products for remote teams',
    'Innovative marketing strategies for eco-friendly fashion brands',
    'Gamified habit-building apps for busy professionals',
    'Automated personal finance & investing agents',
    'Creative online side-hustles with zero starting capital',
  ];

  const handleGenerate = async (e?: React.FormEvent, selectedTopic?: string) => {
    if (e) e.preventDefault();
    const targetTopic = selectedTopic || topic;
    if (!targetTopic.trim()) return;

    setLoading(true);
    setError(null);
    setExportSuccess(null);
    setIdeasResult(null);

    try {
      const res = await fetch('/api/brainstorm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: targetTopic, count }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate ideas');
      setIdeasResult(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleExportToSheets = async () => {
    if (!user) {
      onLogin();
      return;
    }
    if (!ideasResult || !ideasResult.ideas.length) return;

    setExporting(true);
    setError(null);
    setExportSuccess(null);

    try {
      const sheetTitle = `OmniMind Ideas - ${ideasResult.topic.slice(0, 30)} (${new Date().toLocaleDateString()})`;
      const headers = ['Title', 'Category', 'Impact', 'Description', 'Action Item'];
      const rows = ideasResult.ideas.map((idea) => [
        idea.title,
        idea.category,
        idea.impact,
        idea.description,
        idea.actionItem,
      ]);

      const result = await exportToGoogleSheets(sheetTitle, headers, rows);
      setExportSuccess(result.spreadsheetUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to export to Google Sheets');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-screen overflow-y-auto">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-wider uppercase mb-1">
            <Sparkles className="w-4 h-4" /> AI Ideas Generator & Matrix
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ideas & Solutions Lab</h1>
        </div>
        {ideasResult && ideasResult.ideas.length > 0 && (
          <button
            onClick={handleExportToSheets}
            disabled={exporting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Export to Google Sheets
          </button>
        )}
      </div>

      <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Input Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <form onSubmit={(e) => handleGenerate(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                What would you like ideas or answers for?
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Unique mobile app concepts for local community building..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  type="submit"
                  disabled={loading || !topic.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all shrink-0"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  Generate Ideas
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <span className="text-xs text-slate-400 block mb-2 font-medium">Or try a trending topic:</span>
              <div className="flex flex-wrap gap-2">
                {presetTopics.map((pt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setTopic(pt);
                      handleGenerate(undefined, pt);
                    }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700/50 transition-colors flex items-center gap-1.5"
                  >
                    <span>{pt}</span>
                    <ArrowRight className="w-3 h-3 text-indigo-400" />
                  </button>
                ))}
              </div>
            </div>
          </form>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-xl flex items-center gap-3 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {exportSuccess && (
          <div className="bg-emerald-950/40 border border-emerald-800/60 p-4 rounded-xl flex items-center justify-between text-emerald-300 text-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Successfully exported ideas to Google Sheets!</span>
            </div>
            <a
              href={exportSuccess}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition-colors flex items-center gap-1.5"
            >
              Open Google Sheet <FileSpreadsheet className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Results Grid */}
        {ideasResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" /> Ideas for &ldquo;{ideasResult.topic}&rdquo;
              </h2>
              <span className="text-xs bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-3 py-1 rounded-full font-medium">
                {ideasResult.ideas.length} Ideas Generated
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ideasResult.ideas.map((idea, index) => (
                <div
                  key={index}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                        {idea.category}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          idea.impact?.toLowerCase().includes('high')
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/50'
                        }`}
                      >
                        {idea.impact} Impact
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      {index + 1}. {idea.title}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{idea.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 bg-slate-950/40 -mx-5 -mb-5 p-4 rounded-b-2xl">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Action Item:
                    </span>
                    <p className="text-xs text-indigo-300 font-medium">{idea.actionItem}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
