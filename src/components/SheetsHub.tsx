import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  LogIn,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Clock,
  Send,
  Bot,
  User as UserIcon,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { ChatSession } from '../types';
import { exportToGoogleSheets, ExportTemplate } from '../lib/workspace';
import { toast, Toaster } from 'sonner';

interface SheetsHubProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  setActiveTab: (tab: 'chat' | 'brainstorm' | 'sheets') => void;
  activeSession: ChatSession | null;
  sessions?: ChatSession[];
}

interface ExportRecord {
  id: string;
  title: string;
  spreadsheetUrl: string;
  messageCount: number;
  timestamp: number;
}

export const SheetsHub: React.FC<SheetsHubProps> = ({
  user,
  onLogin,
  onLogout,
  setActiveTab,
  activeSession,
  sessions = [],
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    activeSession?.id || (sessions.length > 0 ? sessions[0].id : '')
  );
  const [customSheetTitle, setCustomSheetTitle] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExported, setLastExported] = useState<ExportRecord | null>(null);
  const [recentExports, setRecentExports] = useState<ExportRecord[]>([]);
  const [includeTimestamp, setIncludeTimestamp] = useState<boolean>(true);
  const [roleFilter, setRoleFilter] = useState<'all' | 'model' | 'user'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ExportTemplate>('Default');

  // Update selected session if activeSession changes
  useEffect(() => {
    if (activeSession) {
      setSelectedSessionId(activeSession.id);
    } else if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  }, [activeSession, sessions]);

  const targetSession =
    sessions.find((s) => s.id === selectedSessionId) || activeSession;

  useEffect(() => {
    if (targetSession) {
      setCustomSheetTitle(`[Chat Export] ${targetSession.title || 'Conversation'}`);
    } else {
      setCustomSheetTitle('[Chat Export] New Conversation');
    }
  }, [targetSession?.id, targetSession?.title]);

  const filteredMessages = (targetSession?.messages || []).filter((msg) => {
    if (roleFilter === 'all') return true;
    return msg.role === roleFilter;
  });

  const handleExportActiveSession = async () => {
    if (!user) {
      onLogin();
      return;
    }

    if (!targetSession || targetSession.messages.length === 0) {
      setExportError('Selected chat session has no messages to export.');
      return;
    }

    if (filteredMessages.length === 0) {
      setExportError('No messages match the current role filter.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    const exportPromise = (async () => {
      const sheetTitle =
        customSheetTitle.trim() || `[Chat Export] ${targetSession.title || 'Conversation'}`;

      let headers: string[] = ['Time', 'Role', 'Content'];
      let rows: (string | number)[][] = [];

      const formatDate = (ts: number) => new Date(ts).toLocaleString();

      switch (selectedTemplate) {
        case 'Meeting Minutes':
          headers = ['Timestamp', 'Participant', 'Action/Statement'];
          rows = filteredMessages.map((m) => [
            formatDate(m.timestamp),
            m.role === 'model' ? 'OmniMind AI' : m.senderName || 'User',
            m.content,
          ]);
          break;
        case 'To-Do List':
          headers = ['Task/Item', 'Source', 'Timestamp'];
          filteredMessages.forEach((m) => {
            const lines = m.content.split('\n');
            lines.forEach((line: string) => {
              const trimmed = line.trim();
              if (trimmed.match(/^[-*•\d\[]/)) {
                rows.push([
                  trimmed.replace(/^[-*•\d\.\s\[\]]+/, ''),
                  m.role === 'model' ? 'AI' : 'User',
                  formatDate(m.timestamp),
                ]);
              }
            });
          });
          if (rows.length === 0) {
            rows = [['No clear tasks found in chat history.', '-', '-']];
          }
          break;
        case 'Summary Report':
          headers = ['Category', 'Details'];
          rows = [
            ['Session Title', sheetTitle],
            ['Export Date', new Date().toLocaleString()],
            ['Total Messages', filteredMessages.length],
            ['---', '---'],
            ...filteredMessages.map((m) => [
              m.role === 'model' ? 'Response' : 'Prompt',
              m.content,
            ]),
          ];
          break;
        default:
          headers = includeTimestamp
            ? ['Timestamp', 'Speaker / Role', 'Message Content', 'Sources / Citations']
            : ['Speaker / Role', 'Message Content', 'Sources / Citations'];

          rows = filteredMessages.map((msg) => {
            const timeStr = formatDate(msg.timestamp);
            const roleStr = msg.role === 'model' ? 'OmniMind AI' : msg.senderName || 'User';
            const sourcesStr =
              msg.sources && msg.sources.length > 0
                ? msg.sources.map((s) => `${s.title} (${s.uri})`).join('; ')
                : 'None';

            return includeTimestamp
              ? [timeStr, roleStr, msg.content, sourcesStr]
              : [roleStr, msg.content, sourcesStr];
          });
      }

      const { spreadsheetId, spreadsheetUrl } = await exportToGoogleSheets(
        sheetTitle,
        headers,
        rows
      );

      const record: ExportRecord = {
        id: spreadsheetId,
        title: sheetTitle,
        spreadsheetUrl,
        messageCount: filteredMessages.length,
        timestamp: Date.now(),
      };

      setLastExported(record);
      setRecentExports((prev) => [record, ...prev.slice(0, 4)]);
      return record;
    })();

    toast.promise(exportPromise, {
      loading: 'Exporting chat history to Google Sheets...',
      success: (data) => `Successfully exported to "${data.title}"`,
      error: (err) => `Export failed: ${err.message || 'Unknown error'}`,
    });

    try {
      await exportPromise;
    } catch (err: any) {
      console.error('Export error:', err);
      setExportError(err.message || 'Failed to export chat session to Google Sheets.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-screen overflow-y-auto">
      <Toaster position="top-center" richColors theme="dark" />
      <div className="p-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-1">
          <FileSpreadsheet className="w-4 h-4" /> Google Workspace Integration
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Google Sheets Hub</h1>
        <p className="text-xs text-slate-400 mt-1">
          Export active chat conversations, brainstormed ideas, and research directly into your Google Sheets account.
        </p>
      </div>

      <div className="p-6 max-w-4xl mx-auto w-full space-y-6">
        {/* Connection Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                user
                  ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">
                  {user ? `Connected as ${user.displayName || user.email}` : 'Google Sheets Disconnected'}
                </h2>
                {user && (
                  <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium px-2 py-0.5 rounded-full">
                    Authenticated
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {user
                  ? 'Your account is authorized to export chats and ideas directly into Google Spreadsheets.'
                  : 'Sign in with your Google account to enable 1-click Google Sheets exporting.'}
              </p>
            </div>
          </div>

          <div>
            {user ? (
              <button
                onClick={onLogout}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors border border-slate-700"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            ) : (
              <button
                onClick={onLogin}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
              >
                <LogIn className="w-4 h-4" /> Sign In with Google
              </button>
            )}
          </div>
        </div>

        {/* Primary Feature: Export Active Chat Session Directly to Google Sheets */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <FileSpreadsheet className="w-4 h-4" /> Direct Export
              </div>
              <h2 className="text-lg font-bold text-white mt-1">
                Export Chat Session to Google Sheet
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Save full chat transcripts with sender roles, formatted timestamps, and cited web sources.
              </p>
            </div>

            {targetSession && (
              <span className="bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 text-xs px-3 py-1.5 rounded-xl flex items-center gap-2 self-start sm:self-center">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{targetSession.messages.length} total messages</span>
              </span>
            )}
          </div>

          {/* Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Select Chat Session */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Select Chat Session to Export
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.messages.length} msgs)
                  </option>
                ))}
                {sessions.length === 0 && (
                  <option value="">No chat sessions available</option>
                )}
              </select>
            </div>

            {/* Select Export Template */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Select Export Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value as ExportTemplate)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Default">Default Log</option>
                <option value="Meeting Minutes">Meeting Minutes</option>
                <option value="To-Do List">To-Do List</option>
                <option value="Summary Report">Summary Report</option>
              </select>
            </div>

            {/* Custom Sheet Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                New Google Spreadsheet Title
              </label>
              <input
                type="text"
                value={customSheetTitle}
                onChange={(e) => setCustomSheetTitle(e.target.value)}
                placeholder="Enter title for new spreadsheet"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Export Options */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-4 text-xs text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0"
                />
                <span>Include Timestamps Column</span>
              </label>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Filter:</span>
                <select
                  value={roleFilter}
                  onChange={(e: any) => setRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-2 py-1 text-slate-300"
                >
                  <option value="all">All Messages</option>
                  <option value="model">AI Responses Only</option>
                  <option value="user">User Queries Only</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleExportActiveSession}
              disabled={isExporting || !targetSession || targetSession.messages.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Exporting to Google Sheets...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Export Active Chat to Sheets</span>
                </>
              )}
            </button>
          </div>

          {/* Export Error */}
          {exportError && (
            <div className="bg-red-950/40 border border-red-800 rounded-xl p-3 flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Last Export Success Card */}
          {lastExported && (
            <div className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-emerald-200">
                    Successfully exported to Google Sheets!
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {lastExported.title} &bull; {lastExported.messageCount} messages recorded
                  </div>
                </div>
              </div>

              <a
                href={lastExported.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm shrink-0"
              >
                <span>Open Google Sheet</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Live Messages Preview Table */}
          {targetSession && targetSession.messages.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Transcript Preview ({filteredMessages.length} rows to export)</span>
                <button
                  onClick={() => setActiveTab('chat')}
                  className="text-indigo-400 hover:underline flex items-center gap-1"
                >
                  View in Chat Area &rarr;
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/80 custom-scrollbar">
                {filteredMessages.slice(0, 10).map((m, idx) => (
                  <div key={m.id || idx} className="p-3 text-xs flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {m.role === 'model' ? (
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                          <UserIcon className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-200">
                          {m.role === 'model' ? 'OmniMind AI' : m.senderName || 'User'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(m.timestamp || Date.now()).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-400 line-clamp-2 leading-relaxed">
                        {m.content}
                      </p>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-1 text-[10px] text-emerald-400 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Includes {m.sources.length} cited source(s)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Exports History */}
        {recentExports.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Recent Google Sheets Exports
            </h3>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950 overflow-hidden">
              {recentExports.map((rec) => (
                <div
                  key={rec.id + rec.timestamp}
                  className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-900/60 transition-colors"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{rec.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>{rec.messageCount} messages</span>
                      <span>&bull;</span>
                      <span>{new Date(rec.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <a
                    href={rec.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 bg-emerald-950/60 border border-emerald-800/60 px-3 py-1.5 rounded-lg"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions & Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-2.5 text-indigo-400 font-semibold text-sm">
              <Sparkles className="w-4 h-4" /> 1-Click Exports in ChatArea
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              When chatting in the AI assistant, click the <strong className="text-white">&ldquo;Export to Sheets&rdquo;</strong> button in the top bar to instantly create a new Google Sheet for the current session, or export individual message answers with the button at the bottom of each AI response.
            </p>
            <button
              onClick={() => setActiveTab('chat')}
              className="text-xs text-indigo-400 font-medium hover:underline flex items-center gap-1"
            >
              Go to Chat Assistant &rarr;
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-2.5 text-emerald-400 font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" /> Secure Permissions & Privacy
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              This app requests strict, minimal scopes (<code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300 text-xs">spreadsheets</code> and <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300 text-xs">drive.file</code>) so it can only create and access spreadsheets explicitly generated by you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

