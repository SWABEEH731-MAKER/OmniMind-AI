import React, { useState } from 'react';
import { X, Save, Sparkles, UserPlus, Trash2, BrainCircuit } from 'lucide-react';
import { Persona } from '../types';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (persona: Omit<Persona, 'id'>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  customPersonas: Persona[];
}

export const PersonaModal: React.FC<PersonaModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  customPersonas,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [icon, setIcon] = useState('✨');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !systemInstruction) return;

    setLoading(true);
    try {
      await onSave({ name, description, systemInstruction, icon });
      setName('');
      setDescription('');
      setSystemInstruction('');
      setIcon('✨');
    } finally {
      setLoading(false);
    }
  };

  const icons = ['✨', '💻', '🚀', '📈', '🎨', '🕵️', '🎓', '🤖', '⚡', '🧠'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col md:flex-row overflow-hidden animate-in zoom-in-95 duration-200 h-[80vh] md:h-[600px]">
        
        {/* Left Panel: List & Create */}
        <div className="w-full md:w-1/2 flex flex-col border-r border-slate-800">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Custom Personalities</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {customPersonas.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 opacity-50">
                <Sparkles className="w-8 h-8 text-slate-500" />
                <p className="text-xs text-slate-400">No custom personalities yet. Design your first one on the right!</p>
              </div>
            ) : (
              customPersonas.map((p) => (
                <div 
                  key={p.id}
                  className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl flex items-start gap-4 group hover:border-indigo-500/30 transition-all shadow-sm hover:shadow-indigo-500/5"
                >
                  <span className="text-2xl">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{p.name}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">{p.description}</p>
                  </div>
                  <button
                    onClick={() => onDelete(p.id)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Delete personality"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Form */}
        <div className="w-full md:w-1/2 flex flex-col bg-slate-950/20">
          <div className="p-6 border-b border-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Design New Persona</h2>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                Identity & Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sarcastic Critic, Zen Philosopher..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                Visual Icon
              </label>
              <div className="flex flex-wrap gap-2 p-1">
                {icons.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                      icon === i ? 'bg-indigo-600 border-indigo-400 scale-110 shadow-lg shadow-indigo-600/20' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                    } border`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">
                Short Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief summary for the selector..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1 flex items-center justify-between">
                Core Instructions
                <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-normal">Tone & Style</span>
              </label>
              <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                placeholder="Define exactly how this AI should behave, speak, and think..."
                rows={5}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500/50 transition-colors resize-none leading-relaxed font-mono text-xs"
                required
              />
            </div>
          </form>

          <div className="p-6 border-t border-slate-800 flex justify-end bg-slate-900/50">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || !name || !systemInstruction}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Forge Identity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
