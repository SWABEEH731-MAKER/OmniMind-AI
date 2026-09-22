import React, { useState } from 'react';
import { Users, Copy, Check, X, Wifi, Radio, Shield, Sparkles } from 'lucide-react';
import { Collaborator } from '../types';
import { CollabUser } from '../lib/collab';

interface CollabModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUser: CollabUser;
  onUpdateUserName: (name: string) => void;
  collaborators: Collaborator[];
  isConnected: boolean;
}

export const CollabModal: React.FC<CollabModalProps> = ({
  isOpen,
  onClose,
  roomId,
  currentUser,
  onUpdateUserName,
  collaborators,
  isConnected,
}) => {
  const [copied, setCopied] = useState(false);
  const [tempName, setTempName] = useState(currentUser.name);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateUserName(tempName.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5 text-indigo-400">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Live Collaboration Room
                {isConnected ? (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 font-medium bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded-full">
                    Connecting...
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Multiple users can chat and collaborate simultaneously in this session.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Share Room Invite */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Room Code / Share Link</span>
              <span className="text-[10px] text-slate-500 font-mono">ID: {roomId}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}${window.location.pathname}?room=${roomId}`}
                className="flex-1 bg-slate-900 border border-slate-700 text-xs text-slate-300 px-3 py-2 rounded-lg font-mono outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-colors shrink-0 shadow"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Anyone with this link will instantly join this room and sync chat messages in real time.
            </p>
          </div>

          {/* User Name Setup */}
          <form onSubmit={handleSaveName} className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Your Collaboration Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                placeholder="Enter your name"
                className="flex-1 bg-slate-950 border border-slate-700 text-xs text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors"
              >
                Update Name
              </button>
            </div>
          </form>

          {/* Active Participants Presence List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Active Participants in Room</span>
              <span className="text-slate-400 font-normal">
                {collaborators.length} {collaborators.length === 1 ? 'user' : 'users'} connected
              </span>
            </div>

            <div className="border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/80 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
              {collaborators.map((c) => {
                const isMe = c.id === currentUser.id;
                return (
                  <div
                    key={c.id}
                    className="p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 shadow"
                        style={{ backgroundColor: c.avatarColor || '#6366f1' }}
                      >
                        {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span>{c.name}</span>
                          {isMe && (
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-normal">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {c.isTyping ? 'Typing a message...' : 'Active in room'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] text-emerald-400 font-medium">Online</span>
                    </div>
                  </div>
                );
              })}

              {collaborators.length === 0 && (
                <div className="p-4 text-center text-xs text-slate-500">
                  No other collaborators in this room yet. Share the link above to invite peers!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>WebSocket Live Synchronization</span>
          </div>
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
