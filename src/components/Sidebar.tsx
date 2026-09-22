import React, { useState } from 'react';
import { MessageSquare, Plus, Sparkles, FileSpreadsheet, Trash2, ShieldCheck, LogOut, ExternalLink, Search } from 'lucide-react';
import { ChatSession } from '../types';
import { User } from 'firebase/auth';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  activeTab: 'chat' | 'brainstorm' | 'sheets';
  setActiveTab: (tab: 'chat' | 'brainstorm' | 'sheets') => void;
  user: User | null;
  needsAuth: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  activeTab,
  setActiveTab,
  user,
  needsAuth,
  onLogin,
  onLogout,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const trimmedQuery = searchQuery.toLowerCase().trim();

  const sessionMatches = sessions.map((s) => {
    if (!trimmedQuery) return { session: s, matchesTitle: true, matchCount: 0, snippet: '' };
    const matchesTitle = s.title.toLowerCase().includes(trimmedQuery);
    const matchedMessages = s.messages.filter((m) =>
      m.content.toLowerCase().includes(trimmedQuery)
    );
    const snippet =
      matchedMessages.length > 0
        ? matchedMessages[0].content.slice(0, 50) + (matchedMessages[0].content.length > 50 ? '...' : '')
        : '';
    return {
      session: s,
      matchesTitle,
      matchCount: matchedMessages.length,
      snippet,
      isMatch: matchesTitle || matchedMessages.length > 0,
    };
  });

  const filteredMatches = sessionMatches.filter((item) =>
    !trimmedQuery ? true : item.isMatch
  );

  return (
    <aside className="w-72 bg-slate-900 text-slate-100 flex flex-col h-screen border-r border-slate-800 shrink-0">
      {/* App Branding */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide">OmniMind AI</h1>
            <p className="text-xs text-slate-400">Ideas & Answers Engine</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="p-3 grid grid-cols-3 gap-1 bg-slate-950/40 border-b border-slate-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('chat')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'chat' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab('brainstorm')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'brainstorm' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Ideas Lab
        </button>
        <button
          onClick={() => setActiveTab('sheets')}
          className={`py-2 rounded-lg flex flex-col items-center gap-1 transition-colors ${
            activeTab === 'sheets' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Sheets
        </button>
      </div>

      {/* New Chat Button & Search Bar */}
      {activeTab === 'chat' && (
        <div className="p-3 space-y-2.5">
          <button
            onClick={onNewChat}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>

          <div className="relative group">
            <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-400 absolute left-3 top-3 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats or content..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 rounded-xl pl-9 pr-8 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-slate-500 hover:text-white transition-colors"
                title="Clear search"
              >
                <div className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-800">
                  <span className="text-[10px]">✕</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sessions History (Chat Tab) */}
      {activeTab === 'chat' ? (
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 custom-scrollbar">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1.5 flex items-center justify-between">
            <span>Conversations</span>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
              {searchQuery ? `${filteredMatches.length} / ${sessions.length}` : sessions.length}
            </span>
          </div>
          {filteredMatches.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs px-4">
              {searchQuery ? `No chats found matching "${searchQuery}".` : 'No chat history yet. Start a new conversation above!'}
            </div>
          ) : (
            filteredMatches.map(({ session, matchCount, snippet }) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex flex-col px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${
                  activeSessionId === session.id
                    ? 'bg-slate-800 text-white font-medium shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5 truncate">
                    <MessageSquare className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">{session.title}</span>
                  </div>
                  <button
                    onClick={(e) => onDeleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-700/50 transition-all shrink-0 ml-1"
                    title="Delete chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Show content match hint if matched on message content */}
                {searchQuery && matchCount > 0 && (
                  <div className="mt-1 pl-6 text-[11px] text-indigo-400/90 truncate flex items-center gap-1 font-normal">
                    <span className="text-slate-500">In message:</span>
                    <span className="italic truncate">&ldquo;{snippet}&rdquo;</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'brainstorm' ? (
        <div className="flex-1 p-4 overflow-y-auto text-xs text-slate-400 space-y-3">
          <h2 className="text-slate-200 font-semibold text-sm">💡 Ideas Lab Mode</h2>
          <p>
            Generate structured, actionable idea lists on any topic using Gemini AI.
          </p>
          <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50 text-slate-300 space-y-2">
            <span className="font-medium text-indigo-400 block">✨ Features</span>
            <ul className="list-disc pl-4 space-y-1">
              <li>Instant 10-point idea matrix</li>
              <li>Impact & category tagging</li>
              <li>Actionable execution steps</li>
              <li>One-click Google Sheets export</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4 overflow-y-auto text-xs text-slate-400 space-y-3">
          <h2 className="text-slate-200 font-semibold text-sm">📊 Google Sheets Hub</h2>
          <p>
            Connect your Google account with Sheets permissions to export chat logs and brainstormed ideas directly into your Google Drive.
          </p>
          <div className="bg-emerald-950/30 p-3 rounded-xl border border-emerald-800/40 text-emerald-300 space-y-2">
            <span className="font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Secure Integration
            </span>
            <p className="text-emerald-400/80 text-[11px]">
              Uses official Google Workspace OAuth via Firebase Auth. Your data remains completely private.
            </p>
          </div>
        </div>
      )}

      {/* User Auth Section */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        {user ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 truncate">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border border-slate-700" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
                  {user.email?.[0].toUpperCase() || 'U'}
                </div>
              )}
              <div className="truncate">
                <p className="text-xs font-medium text-slate-200 truncate">{user.displayName || 'Google User'}</p>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Sheets Connected
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="w-full bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-2 shadow transition-all active:scale-[0.98]"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            Sign in for Sheets
          </button>
        )}
      </div>
    </aside>
  );
};
