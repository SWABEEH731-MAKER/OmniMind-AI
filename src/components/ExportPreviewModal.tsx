import React from 'react';
import { X, FileText, FileDown, Download, MessageSquare } from 'lucide-react';
import { ChatSession } from '../types';

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ChatSession;
  onExport: (format: 'txt' | 'pdf' | 'md') => void;
}

export const ExportPreviewModal: React.FC<ExportPreviewModalProps> = ({
  isOpen,
  onClose,
  session,
  onExport,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
              <Download className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Export Preview</h2>
              <p className="text-xs text-slate-400 mt-0.5">Review your transcript before downloading</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Document Metadata Card */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Document Details</span>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20">
                Ready to sync
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-500 font-medium">Session Title</p>
                <p className="text-sm text-slate-200 truncate">{session.title}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-medium">Total Messages</p>
                <p className="text-sm text-slate-200">{session.messages.length} units</p>
              </div>
            </div>
          </div>

          {/* Transcript Preview Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5" />
              Content Snippet
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-300 space-y-4 max-h-[300px] overflow-y-auto">
              {session.messages.slice(0, 5).map((msg, idx) => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={msg.role === 'user' ? 'text-indigo-400' : 'text-emerald-400'}>
                      [{msg.role.toUpperCase()}]
                    </span>
                    <span className="text-slate-600">—</span>
                    <span className="text-slate-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="line-clamp-3 leading-relaxed opacity-80">{msg.content}</p>
                </div>
              ))}
              {session.messages.length > 5 && (
                <div className="pt-2 text-center text-slate-600 italic">
                  ... and {session.messages.length - 5} more messages ...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/50 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onExport('txt')}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition-all active:scale-[0.98]"
          >
            <FileText className="w-4 h-4 text-sky-400" />
            Download Text
          </button>
          <button
            onClick={() => onExport('md')}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs border border-slate-700 transition-all active:scale-[0.98]"
          >
            <FileCode className="w-4 h-4 text-indigo-400" />
            Markdown (.md)
          </button>
          <button
            onClick={() => onExport('pdf')}
            className="flex-1 min-w-[140px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <FileDown className="w-4 h-4" />
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
};

const FileCode = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>
  </svg>
);
