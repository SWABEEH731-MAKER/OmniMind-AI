import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  RotateCw,
  FileSpreadsheet,
  Loader2,
  Cpu,
  ChevronDown,
  Trash2,
  Clock,
  Users,
  Globe,
  BookOpen,
  Volume2,
  VolumeX,
  ExternalLink,
  Share2,
  Download,
  FileText,
  FileCode,
  FileDown,
  Map,
  Music,
  Video,
  Image as ImageIcon,
  Mic,
  MicOff,
  Radio,
  History,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { ChatSession, Message, Persona, GroundingSource, KnowledgeItem, Collaborator } from '../types';
import { exportToGoogleSheets } from '../lib/workspace';
import { downloadAsText, downloadAsMarkdown, downloadAsPDF } from '../lib/exportUtils';
import { ExportPreviewModal } from './ExportPreviewModal';
import { PersonaModal } from './PersonaModal';
import { CollabManager, CollabUser } from '../lib/collab';
import { CollabModal } from './CollabModal';
import { KnowledgeBaseModal } from './KnowledgeBaseModal';

interface GeminiModelOption {
  id: string;
  name: string;
  versionBadge: string;
  badge: string;
  badgeColor: string;
  description: string;
  strengths: string[];
}

export const GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    versionBadge: 'Flash (Recommended)',
    badge: 'Fast & Smart',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    description: 'Blazing fast, high-performance general intelligence for daily conversation, creative ideas, and fast answers.',
    strengths: ['Fast Turnaround', 'Daily Chat', 'Multimodal'],
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    versionBadge: 'Pro Edition',
    badge: 'Deep Reasoning',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    description: 'Advanced reasoning, deep logic, architecture, full-stack code debugging, and complex problem-solving.',
    strengths: ['Complex Coding', 'Deep Analysis', 'Advanced Logic'],
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    versionBadge: 'Flash Lite',
    badge: 'Ultra Fast',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'Lightweight and ultra-responsive model optimized for minimal latency, quick summaries, and rapid turnaround.',
    strengths: ['Minimal Latency', 'Rapid Answers', 'High Efficiency'],
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash (Latest)',
    versionBadge: 'Stable Flash',
    badge: 'High Throughput',
    badgeColor: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    description: 'Stable, high-capacity Gemini Flash production model with consistent throughput across diverse queries.',
    strengths: ['High Throughput', 'Broad Knowledge', 'Reliable'],
  },
];

interface ChatAreaProps {
  session: ChatSession | null;
  onUpdateSessionMessages: (sessionId: string, newMessages: Message[]) => void;
  onCreateNewSessionWithFirstMessage: (text: string, modelToUse?: string) => void;
  onUpdateSessionModel?: (sessionId: string, model: string) => void;
  user: any;
  onLogin: () => void;
}

// Dedicated Code Block component with Copy button
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-md">
      <div className="bg-slate-900/90 px-4 py-2 flex items-center justify-between text-xs text-slate-400 border-b border-slate-800">
        <span className="font-mono uppercase font-semibold text-slate-300">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-white transition-colors bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700/60"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed custom-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const ChatArea: React.FC<ChatAreaProps> = ({
  session,
  onUpdateSessionMessages,
  onCreateNewSessionWithFirstMessage,
  onUpdateSessionModel,
  user,
  onLogin,
}) => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(session?.model || 'gemini-3.8-flash');
  const [selectedPersonaId, setSelectedPersonaId] = useState(session?.personaId || 'assistant');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);
  const [exportingFullChat, setExportingFullChat] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [customPersonas, setCustomPersonas] = useState<Persona[]>([]);

  // Feature Toggles: Grounding & Knowledge Base
  const [enableSearch, setEnableSearch] = useState<boolean>(true);
  const [enableMaps, setEnableMaps] = useState<boolean>(false);
  const [isLiveMode, setIsLiveMode] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionText, setTranscriptionText] = useState<string>('');
  
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState<boolean>(false);

  // Collaboration State
  const [isCollabOpen, setIsCollabOpen] = useState<boolean>(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ id: string; name: string }[]>([]);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [collabUser, setCollabUser] = useState<CollabUser>(() => ({
    id: user?.uid || `user-${Math.random().toString(36).substring(2, 7)}`,
    name: user?.displayName || user?.email?.split('@')[0] || `User ${Math.floor(Math.random() * 900 + 100)}`,
    avatarColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][Math.floor(Math.random() * 5)],
  }));

  const collabRef = useRef<CollabManager | null>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const liveWsRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<any>(null);

  // Sync custom personas from Firestore
  useEffect(() => {
    if (!user) return;
    const path = `users/${user.uid}/personas`;
    const personaQuery = query(collection(db, 'users', user.uid, 'personas'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(personaQuery, (snapshot) => {
      const fbPersonas: Persona[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Persona));
      setCustomPersonas(fbPersonas);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path, auth);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync messages with Firestore if logged in
  useEffect(() => {
    if (!user || !session) return;

    const sessionDocRef = doc(db, 'sessions', session.id);
    const unsubscribeSession = onSnapshot(sessionDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.isAiThinking !== undefined) {
          // If another user triggered the AI, we should show loading too
          // But only if we are not the one who sent the message (already handled)
          setLoading(data.isAiThinking);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `sessions/${session.id}`, auth);
    });

    const msgPath = `sessions/${session.id}/messages`;
    const messagesQuery = query(
      collection(db, 'sessions', session.id, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const fbMessages: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          // Convert Firestore timestamp to number if needed
          timestamp: data.timestamp?.toMillis?.() || data.timestamp || Date.now()
        } as Message;
      });
      
      if (fbMessages.length > 0) {
        onUpdateSessionMessages(session.id, fbMessages);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, msgPath, auth);
    });

    return () => {
      unsubscribeSession();
      unsubscribe();
    };
  }, [user, session?.id]);

  // Initialize Gemini Live WebSocket
  useEffect(() => {
    if (isLiveMode) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/live`);
      
      ws.onopen = () => console.log('Gemini Live WS Connected');
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'response') {
          // Handle live response stream
          console.log('Live Response:', data.text);
        }
      };
      
      liveWsRef.current = ws;
    } else {
      liveWsRef.current?.close();
      liveWsRef.current = null;
    }

    return () => liveWsRef.current?.close();
  }, [isLiveMode]);

  // Dropdown menus
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Sync model with session when active session changes
  useEffect(() => {
    if (session?.model) {
      setModel(session.model);
    }
  }, [session?.id, session?.model]);

  // Sync user name if authentication changes
  useEffect(() => {
    if (user?.displayName || user?.email) {
      const name = user.displayName || user.email.split('@')[0];
      const updated = { ...collabUser, id: user.uid, name };
      setCollabUser(updated);
      collabRef.current?.setUser(updated);
    }
  }, [user]);

  // Load Knowledge Base Items
  useEffect(() => {
    const fetchKnowledge = async () => {
      try {
        const res = await fetch('/api/knowledge');
        if (res.ok) {
          const data = await res.json();
          setKnowledgeItems(data);
        }
      } catch (err) {
        console.error('Failed to load knowledge base:', err);
      }
    };
    fetchKnowledge();
  }, []);

  // Initialize Collaboration WebSocket Manager
  useEffect(() => {
    const roomId = session?.id || 'public-room';
    const manager = new CollabManager(collabUser);

    manager.onPresenceUpdate = (users: Collaborator[]) => {
      setCollaborators(users);
    };

    manager.onUserTyping = (users: { id: string; name: string }[]) => {
      setTypingUsers(users);
    };

    manager.onNewMessage = (incomingMsg: Message) => {
      if (session) {
        // Avoid duplicate messages
        const exists = session.messages.some((m) => m.id === incomingMsg.id);
        if (!exists) {
          onUpdateSessionMessages(session.id, [...session.messages, incomingMsg]);
        }
      }
    };

    manager.onStatusChange = (connected: boolean) => {
      setIsWsConnected(connected);
    };

    manager.joinRoom(roomId);
    collabRef.current = manager;

    return () => {
      manager.leaveRoom();
    };
  }, [session?.id]);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setShowModelMenu(false);
      }
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node)) {
        setShowPersonaMenu(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const personas: Persona[] = [
    {
      id: 'assistant',
      name: 'OmniMind Assistant',
      description: 'Balanced, intelligent, and articulate for all ideas & answers.',
      systemInstruction:
        'You are OmniMind, an advanced, articulate AI assistant that gives comprehensive ideas, detailed answers, and expert insights.',
      icon: '✨',
    },
    {
      id: 'coder',
      name: 'Software Engineer',
      description: 'Expert programmer for debugging, architecture, and production code.',
      systemInstruction:
        'You are an expert senior software engineer. Provide robust, production-ready code with clean syntax and brief explanations.',
      icon: '💻',
    },
    {
      id: 'creative',
      name: 'Creative Innovator',
      description: 'Unconventional brainstorming, storytelling, and imaginative concepts.',
      systemInstruction:
        'You are a visionary creative director and brainstormer. Think outside the box and inspire bold ideas.',
      icon: '🚀',
    },
    {
      id: 'strategist',
      name: 'Business Strategist',
      description: 'Startup growth, market analysis, financial models, and strategic planning.',
      systemInstruction:
        'You are a seasoned startup founder and business strategist. Focus on high-impact growth, unit economics, and actionable execution.',
      icon: '📈',
    },
  ];

  const allPersonas = [...personas, ...customPersonas];
  const currentPersona = allPersonas.find((p) => p.id === selectedPersonaId) || personas[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [session?.messages, loading, typingUsers]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    collabRef.current?.sendTypingStatus(true);

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = setTimeout(() => {
      collabRef.current?.sendTypingStatus(false);
    }, 1800);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    collabRef.current?.sendTypingStatus(false);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now(),
      senderName: collabUser.name,
    };

    // Broadcast user message to collaborators
    collabRef.current?.broadcastMessage(userMsg);

    if (!session) {
      onCreateNewSessionWithFirstMessage(userText, model);
      return;
    }

    const updatedMessages = [...session.messages, userMsg];
    onUpdateSessionMessages(session.id, updatedMessages);
    
    // Persist user message to Firestore if logged in
    if (user && session) {
      await addDoc(collection(db, 'sessions', session.id, 'messages'), {
        ...userMsg,
        timestamp: serverTimestamp()
      });
      
      await updateDoc(doc(db, 'sessions', session.id), {
        updatedAt: serverTimestamp(),
        isAiThinking: true // Inform other users that AI is thinking
      });
    }

    setLoading(true);

    // Build Knowledge Base context from stored items
    const knowledgeBaseContext =
      knowledgeItems.length > 0
        ? knowledgeItems
            .map(
              (item) =>
                `Title: ${item.title}\nContent: ${item.content}${
                  item.sourceUrl ? `\nSource: ${item.sourceUrl}` : ''
                }`
            )
            .join('\n\n---\n\n')
        : undefined;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          model,
          systemInstruction: currentPersona.systemInstruction,
          enableSearch,
          enableMaps,
          knowledgeBaseContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate response');

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.content,
        timestamp: Date.now(),
        sources: data.sources || [],
        searchQueries: data.searchQueries || [],
      };

      // Persist to Firestore if user is logged in
      if (user && session) {
        await addDoc(collection(db, 'sessions', session.id, 'messages'), {
          ...modelMsg,
          timestamp: serverTimestamp()
        });
        
        await updateDoc(doc(db, 'sessions', session.id), {
          updatedAt: serverTimestamp(),
          isAiThinking: false // Thinking finished
        });
      }

      // Broadcast AI response to peers in room
      collabRef.current?.broadcastMessage(modelMsg);

      onUpdateSessionMessages(session.id, [...updatedMessages, modelMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `⚠️ Error: ${err.message || 'Failed to communicate with AI server.'}`,
        timestamp: Date.now(),
      };
      collabRef.current?.broadcastMessage(errorMsg);
      onUpdateSessionMessages(session.id, [...updatedMessages, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Text to Speech
  const handleToggleTTS = (text: string, index: number) => {
    if (!('speechSynthesis' in window)) {
      alert('Text-to-Speech is not supported in your browser.');
      return;
    }

    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Clean text of markdown characters for cleaner speech
    const cleanText = text
      .replace(/[#*`_~\[\]]/g, '')
      .replace(/```[\s\S]*?```/g, 'Code snippet omitted for speech.')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const handleExportMessageToSheets = async (msg: Message, index: number) => {
    if (!user) {
      onLogin();
      return;
    }

    setExportingIndex(index);
    setExportSuccessMsg(null);
    try {
      const sheetTitle = `OmniMind AI Answer - ${new Date().toLocaleDateString()}`;
      const headers = ['Timestamp', 'AI Response / Answer', 'Cited Sources'];
      const sourcesText =
        msg.sources && msg.sources.length > 0
          ? msg.sources.map((s) => `${s.title} (${s.uri})`).join('; ')
          : 'None';

      const rows = [[new Date(msg.timestamp || Date.now()).toLocaleString(), msg.content, sourcesText]];

      const result = await exportToGoogleSheets(sheetTitle, headers, rows);
      setExportSuccessMsg(result.spreadsheetUrl);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingIndex(null);
    }
  };

  const handleExportFullConversation = async () => {
    if (!user) {
      onLogin();
      return;
    }
    if (!session || session.messages.length === 0) return;

    setExportingFullChat(true);
    setExportSuccessMsg(null);
    try {
      const sheetTitle = `OmniMind Chat - ${session.title || 'Conversation'} (${new Date().toLocaleDateString()})`;
      const headers = ['Timestamp', 'Speaker / Role', 'Message Content', 'Sources / Citations'];
      const rows = session.messages.map((m) => {
        const sourcesText =
          m.sources && m.sources.length > 0
            ? m.sources.map((s) => `${s.title} (${s.uri})`).join('; ')
            : 'None';

        return [
          new Date(m.timestamp || Date.now()).toLocaleString(),
          m.role === 'user' ? m.senderName || 'User' : 'AI (OmniMind)',
          m.content,
          sourcesText,
        ];
      });

      const result = await exportToGoogleSheets(sheetTitle, headers, rows);
      setExportSuccessMsg(result.spreadsheetUrl);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingFullChat(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!session || session.messages.length === 0) return;
    handleOpenExportPreview();
  };

  const handleExportText = () => {
    if (!session || session.messages.length === 0) return;
    handleOpenExportPreview();
  };

  const handleExportPDF = () => {
    if (!session || session.messages.length === 0) return;
    handleOpenExportPreview();
  };

  const handleOpenExportPreview = () => {
    if (!session || session.messages.length === 0) return;
    setIsPreviewModalOpen(true);
  };

  const handleExportFromPreview = (format: 'txt' | 'pdf' | 'md') => {
    if (!session) return;
    if (format === 'txt') downloadAsText(session);
    else if (format === 'pdf') downloadAsPDF(session);
    else if (format === 'md') downloadAsMarkdown(session);
    setIsPreviewModalOpen(false);
  };

  const handleGenerateMedia = async (type: 'image' | 'music' | 'video') => {
    if (!input.trim()) return;
    
    const prompt = input.trim();
    setInput('');
    setLoading(true);

    try {
      const endpoint = `/api/generate/${type}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to generate ${type}`);

      let content = `I've generated the ${type} based on your prompt: "${prompt}"\n\n`;
      if (type === 'image') content += `![Generated Image](${data.url})`;
      else if (type === 'music') content += `[Listen to generated audio](${data.url})`;
      else if (type === 'video') content += `[Watch generated video](${data.url})`;

      const mediaMsg: Message = {
        id: Date.now().toString(),
        role: 'model',
        content,
        timestamp: Date.now(),
      };

      if (user && session) {
        await addDoc(collection(db, 'sessions', session.id, 'messages'), {
          ...mediaMsg,
          timestamp: serverTimestamp()
        });
      }

      onUpdateSessionMessages(session!.id, [...(session?.messages || []), mediaMsg]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    if (!session) return;
    if (window.confirm('Are you sure you want to clear all messages in this chat?')) {
      onUpdateSessionMessages(session.id, []);
    }
  };

  const handleStartTranscription = async () => {
    setIsTranscribing(true);
    setTranscriptionText('Listening...');
    
    try {
      const res = await fetch('/api/transcribe', { method: 'POST' });
      const data = await res.json();
      setTranscriptionText(data.text);
      setInput(prev => prev + ' ' + data.text);
    } catch (err) {
      console.error('Transcription error:', err);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleToggleDictation = () => {
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsDictating(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsDictating(false);
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSavePersona = async (newPersona: Omit<Persona, 'id'>) => {
    if (!user) {
      onLogin();
      return;
    }
    await addDoc(collection(db, 'users', user.uid, 'personas'), newPersona);
    setIsPersonaModalOpen(false);
  };

  const handleDeletePersona = async (id: string) => {
    if (!user) return;
    const personaDoc = doc(db, 'users', user.uid, 'personas', id);
    await updateDoc(personaDoc, { deleted: true }); // Simple soft delete or full delete
    // For this example, let's just delete it
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(personaDoc);
  };

  // Knowledge Base Actions
  const handleAddKnowledgeItem = async (item: { title: string; content: string; sourceUrl?: string }) => {
    const res = await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    if (!res.ok) throw new Error('Failed to create knowledge item');
    const created = await res.json();
    setKnowledgeItems((prev) => [created, ...prev]);
  };

  const handleDeleteKnowledgeItem = async (id: string) => {
    const res = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete knowledge item');
    setKnowledgeItems((prev) => prev.filter((k) => k.id !== id));
  };

  const currentModel = GEMINI_MODELS.find((m) => m.id === model) || GEMINI_MODELS[0];

  const handleSelectModel = (newModelId: string) => {
    setModel(newModelId);
    setShowModelMenu(false);
    if (session && onUpdateSessionModel) {
      onUpdateSessionModel(session.id, newModelId);
    }
  };

  const promptStarters = [
    '💡 Give me 5 innovative business ideas in AI and robotics',
    '💻 Write a TypeScript custom hook for real-time WebSockets',
    '🔍 What are the latest developments in quantum computing research?',
    '✍️ Draft a comprehensive project brief with milestones and deliverables',
  ];

  // Format timestamp cleanly
  const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between shrink-0">
        {/* Left: Persona Selector */}
        <div className="flex items-center gap-3">
          <div className="relative" ref={personaMenuRef}>
            <button
              onClick={() => {
                setShowPersonaMenu(!showPersonaMenu);
                setShowModelMenu(false);
              }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
            >
              <span className="text-sm">{currentPersona.icon}</span>
              <span className="hidden sm:inline">{currentPersona.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showPersonaMenu && (
              <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  AI Personalities
                  <button 
                    onClick={() => {
                      setIsPersonaModalOpen(true);
                      setShowPersonaMenu(false);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    + Create New
                  </button>
                </div>
                {allPersonas.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPersonaId(p.id);
                      setShowPersonaMenu(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-3 hover:bg-slate-800 transition-colors ${
                      selectedPersonaId === p.id ? 'bg-indigo-600/20 text-indigo-300' : 'text-slate-300'
                    }`}
                  >
                    <span className="text-lg">{p.icon}</span>
                    <div>
                      <div className="text-xs font-semibold text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-400 leading-snug">{p.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Real-time Collaboration Button & Presence Badge */}
          <button
            onClick={() => setIsCollabOpen(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              collaborators.length > 1
                ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700'
            }`}
            title="Open real-time collaboration room"
          >
            <div className="relative">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              {isWsConnected && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse ring-1 ring-slate-900" />
              )}
            </div>
            <span className="hidden sm:inline">Collab</span>
            <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300">
              {collaborators.length}
            </span>
          </button>

          {/* Google Search Toggle */}
          <button
            onClick={() => setEnableSearch(!enableSearch)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              enableSearch
                ? 'bg-sky-950/50 border-sky-700/60 text-sky-300 hover:bg-sky-900/50'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 border-slate-700'
            }`}
            title="Toggle Google Search grounding"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Search</span>
          </button>

          {/* Google Maps Toggle */}
          <button
            onClick={() => setEnableMaps(!enableMaps)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              enableMaps
                ? 'bg-rose-950/50 border-rose-700/60 text-rose-300 hover:bg-rose-900/50'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 border-slate-700'
            }`}
            title="Toggle Google Maps grounding"
          >
            <Map className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Maps</span>
          </button>

          {/* Live Mode Toggle */}
          <button
            onClick={() => setIsLiveMode(!isLiveMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              isLiveMode
                ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-400 border-slate-700'
            }`}
            title="Toggle Gemini Live mode"
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Live Mode</span>
            {isLiveMode && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />}
          </button>

          {/* Knowledge Base Modal Trigger */}
          <button
            onClick={() => setIsKnowledgeBaseOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
            title="Manage knowledge base and custom documents"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Knowledge</span>
            <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400">
              {knowledgeItems.length}
            </span>
          </button>
        </div>

        {/* Right: Model Selector & Actions */}
        <div className="flex items-center gap-2">
          {session && session.messages.length > 0 && (
            <>
              {/* Direct 'Download as Markdown' button */}
              <button
                onClick={handleOpenExportPreview}
                className="bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-medium px-2.5 sm:px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                title="Download active session as Markdown (.md)"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden xl:inline">Download as Markdown</span>
                <span className="hidden sm:inline xl:hidden">MD</span>
              </button>

              {/* Direct 'Export as Text' button */}
              <button
                onClick={handleOpenExportPreview}
                className="bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-medium px-2.5 sm:px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                title="Export chat conversation as a text file (.txt)"
              >
                <FileText className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden xl:inline">Export as Text</span>
                <span className="hidden md:inline xl:hidden">TXT</span>
              </button>

              {/* Direct 'Download PDF' button */}
              <button
                onClick={handleOpenExportPreview}
                className="bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 font-medium px-2.5 sm:px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-[0.98]"
                title="Download chat transcript as a formatted PDF"
              >
                <FileDown className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden xl:inline">Download PDF</span>
                <span className="hidden md:inline xl:hidden">PDF</span>
              </button>

              {/* Export to Google Sheets Button */}
              <button
                onClick={handleExportFullConversation}
                disabled={exportingFullChat}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3 sm:px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
                title="Export entire chat session to Google Sheets"
              >
                {exportingFullChat ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Export to Sheets</span>
                <span className="sm:hidden">Sheets</span>
              </button>

              {/* Export Dropdown for responsive screens / complete menu */}
              <div className="relative sm:hidden" ref={exportMenuRef}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-xs text-slate-200 border border-slate-700"
                  title="More Export Options"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-1.5 z-50">
                    <button
                      onClick={handleExportMarkdown}
                      className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Download as Markdown</span>
                    </button>
                    <button
                      onClick={handleExportText}
                      className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                      <span>Export as Text (.txt)</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="w-full text-left px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <FileDown className="w-3.5 h-3.5 text-rose-400" />
                      <span>Download as PDF</span>
                    </button>
                    <button
                      onClick={handleExportFullConversation}
                      className="w-full text-left px-3 py-2 text-xs text-emerald-300 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export to Google Sheets</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {session && session.messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-800 font-medium px-2.5 py-2 rounded-xl text-xs flex items-center gap-1 transition-all"
              title="Clear all messages in this session"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Model Selector Dropdown */}
          <div className="relative" ref={modelMenuRef}>
            <button
              onClick={() => {
                setShowModelMenu(!showModelMenu);
                setShowPersonaMenu(false);
              }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-200 border border-slate-700 transition-colors"
              title="Switch Gemini model version"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-white hidden sm:inline">{currentModel.name}</span>
              <span className="font-semibold text-white sm:hidden">Model</span>
              <span
                className={`hidden lg:inline text-[10px] px-1.5 py-0.5 rounded border font-medium ${currentModel.badgeColor}`}
              >
                {currentModel.badge}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                  showModelMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showModelMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50">
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2 mb-1">
                  <span>Select Gemini Model</span>
                  <span className="text-slate-500 font-normal">Active: {currentModel.name}</span>
                </div>
                <div className="max-h-[380px] overflow-y-auto px-1.5 space-y-1 custom-scrollbar">
                  {GEMINI_MODELS.map((m) => {
                    const isSelected = model === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleSelectModel(m.id)}
                        className={`w-full text-left p-3 rounded-xl flex items-start gap-3 transition-colors ${
                          isSelected
                            ? 'bg-indigo-600/15 border border-indigo-500/30 text-slate-100'
                            : 'hover:bg-slate-800 text-slate-300 border border-transparent'
                        }`}
                      >
                        <div
                          className={`mt-0.5 p-1.5 rounded-lg ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Cpu className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold text-white">{m.name}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({m.versionBadge})
                              </span>
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${m.badgeColor}`}
                            >
                              {m.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 leading-snug">{m.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 custom-scrollbar">
        {!session || session.messages.length === 0 ? (
          <div className="max-w-2xl mx-auto h-full flex flex-col justify-center items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl">
              <Sparkles className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">How can OmniMind assist you?</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Powered by Gemini models with real-time web search citations, customizable knowledge base documents, and instant Google Sheets exports.
              </p>
            </div>

            {/* Prompt Starters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl text-left">
              {promptStarters.map((starter, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(starter.replace(/^[^\s]+\s/, ''));
                  }}
                  className="p-3.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 transition-all text-left group shadow-sm"
                >
                  <span className="group-hover:text-white transition-colors">{starter}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {session.messages.map((msg, index) => (
              <div
                key={msg.id || index}
                className={`flex items-start gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                  }`}
                >
                  {/* Message Header with Formatted Timestamp */}
                  <div
                    className={`flex items-center justify-between gap-3 mb-2 pb-1.5 border-b text-[11px] ${
                      msg.role === 'user'
                        ? 'border-indigo-500/40 text-indigo-200'
                        : 'border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <span>{msg.role === 'model' ? 'OmniMind AI' : msg.senderName || 'You'}</span>
                      {msg.role === 'model' && (
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-normal">
                          {currentModel.name}
                        </span>
                      )}
                    </div>
                    {/* Formatted Timestamp with Clock Icon */}
                    <div className="flex items-center gap-1 font-mono text-[10px] opacity-80">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(msg.timestamp)}</span>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="markdown-body space-y-3">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                        components={{
                          h1({ children }: any) {
                            return (
                              <h1 className="text-xl font-bold text-white mt-4 mb-2 pb-1.5 border-b border-slate-800">
                                {children}
                              </h1>
                            );
                          },
                          h2({ children }: any) {
                            return (
                              <h2 className="text-lg font-bold text-slate-100 mt-3 mb-1.5">
                                {children}
                              </h2>
                            );
                          },
                          h3({ children }: any) {
                            return (
                              <h3 className="text-base font-semibold text-slate-200 mt-2.5 mb-1">
                                {children}
                              </h3>
                            );
                          },
                          h4({ children }: any) {
                            return (
                              <h4 className="text-sm font-semibold text-slate-300 mt-2 mb-1">
                                {children}
                              </h4>
                            );
                          },
                          p({ children }: any) {
                            return (
                              <p className="mb-2.5 leading-relaxed text-slate-200 last:mb-0">
                                {children}
                              </p>
                            );
                          },
                          ul({ children }: any) {
                            return (
                              <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-slate-200">
                                {children}
                              </ul>
                            );
                          },
                          ol({ children }: any) {
                            return (
                              <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-slate-200">
                                {children}
                              </ol>
                            );
                          },
                          li({ children }: any) {
                            return <li className="leading-relaxed pl-1">{children}</li>;
                          },
                          strong({ children }: any) {
                            return <strong className="font-semibold text-white">{children}</strong>;
                          },
                          em({ children }: any) {
                            return <em className="italic text-indigo-200/90">{children}</em>;
                          },
                          blockquote({ children }: any) {
                            return (
                              <blockquote className="border-l-4 border-indigo-500 bg-slate-950/60 pl-3.5 py-1.5 my-3 rounded-r-lg italic text-slate-300">
                                {children}
                              </blockquote>
                            );
                          },
                          hr() {
                            return <hr className="my-3.5 border-slate-800" />;
                          },
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            const codeString = String(children).replace(/\n$/, '');

                            if (!inline && match) {
                              return <CodeBlock language={match[1]} code={codeString} />;
                            }

                            return (
                              <code
                                className="bg-slate-800/90 text-indigo-300 px-1.5 py-0.5 rounded text-xs font-mono border border-slate-700/60"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          table({ children }: any) {
                            return (
                              <div className="my-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                                <table className="w-full text-left text-xs border-collapse">{children}</table>
                              </div>
                            );
                          },
                          th({ children }: any) {
                            return (
                              <th className="bg-slate-900 px-4 py-2.5 font-semibold text-slate-200 border-b border-slate-800">
                                {children}
                              </th>
                            );
                          },
                          td({ children }: any) {
                            return (
                              <td className="px-4 py-2.5 border-b border-slate-800/60 text-slate-300">
                                {children}
                              </td>
                            );
                          },
                          a({ href, children }: any) {
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-400 hover:text-indigo-300 underline font-medium inline-flex items-center gap-0.5"
                              >
                                {children}
                              </a>
                            );
                          },
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>

                      {/* Cited Sources & Grounding Box */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <Globe className="w-3.5 h-3.5" />
                            <span>Cited Sources ({msg.sources.length})</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.sources.map((source, sIdx) => {
                              let hostname = source.uri;
                              try {
                                hostname = new URL(source.uri).hostname.replace('www.', '');
                              } catch (_) {}

                              return (
                                <a
                                  key={sIdx}
                                  href={source.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-emerald-700/60 p-2.5 rounded-xl text-xs transition-colors flex items-start justify-between gap-2 group/source"
                                >
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-200 group-hover/source:text-emerald-300 truncate">
                                      {source.title || hostname}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono truncate">
                                      {hostname}
                                    </div>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover/source:text-emerald-400 shrink-0 mt-0.5" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                  {/* Message Action Bar (Copy, TTS, Export to Sheets) */}
                  {msg.role === 'model' && (
                    <div className="flex flex-wrap items-center gap-3 mt-3 pt-2.5 border-t border-slate-800 text-slate-400 text-xs">
                      {/* Copy Answer */}
                      <button
                        onClick={() => handleCopy(msg.content, index)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                          copiedIndex === index
                            ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300'
                            : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                        title="Copy message to clipboard"
                      >
                        {copiedIndex === index ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === index ? 'Copied!' : 'Copy'}</span>
                      </button>

                      {/* Text-to-Speech */}
                      <button
                        onClick={() => handleToggleTTS(msg.content, index)}
                        className={`flex items-center gap-1 transition-colors ${
                          speakingIndex === index ? 'text-indigo-400 font-medium' : 'hover:text-white'
                        }`}
                        title={speakingIndex === index ? 'Stop speaking' : 'Listen to answer'}
                      >
                        {speakingIndex === index ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>

                      {/* Export this message to Google Sheets */}
                      <button
                        onClick={() => handleExportMessageToSheets(msg, index)}
                        disabled={exportingIndex === index}
                        className="flex items-center gap-1 hover:text-emerald-400 transition-colors ml-auto"
                        title="Export this answer to a Google Sheet"
                      >
                        {exportingIndex === index ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        ) : (
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                        )}
                        <span>Export to Sheets</span>
                      </button>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md font-bold text-xs"
                    style={{ backgroundColor: collabUser.avatarColor || '#4f46e5' }}
                  >
                    {collabUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            ))}

            {/* Live Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-slate-400 animate-in fade-in">
                <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400 shrink-0">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                  </span>
                  <span className="text-slate-300">
                    {typingUsers.map((u) => u.name).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              </div>
            )}

            {loading && (
              <div className="flex items-start gap-3.5 animate-in fade-in">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-500/30">
                  <Bot className="w-4 h-4 animate-pulse" />
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-slate-300 text-sm shadow-md space-y-2.5 max-w-sm sm:max-w-md">
                  <div className="flex items-center gap-2">
                    <span className="flex gap-1.5 items-center">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" />
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
                    </span>
                    <span className="text-xs font-semibold text-indigo-300">
                      OmniMind is typing a response...
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                    <span>
                      {enableSearch
                        ? 'Retrieving knowledge sources and formulating answer'
                        : 'Synthesizing response and formatting markdown'}
                    </span>
                    <span className="inline-block w-1.5 h-3.5 bg-indigo-400 animate-pulse ml-0.5 rounded-sm" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Export Success Notification Banner */}
      {exportSuccessMsg && (
        <div className="bg-emerald-950/90 border-t border-emerald-800 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Successfully exported chat history directly into Google Sheets!</span>
          </div>
          <a
            href={exportSuccessMsg}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-3.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
          >
            <span>Open Google Sheet</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/40 backdrop-blur shrink-0">
        <div className="max-w-3xl mx-auto space-y-3">
          
          {/* AI Toolbox / Media Generation Row */}
          <div className="flex flex-wrap items-center gap-2 px-1">
            <button
              onClick={() => handleGenerateMedia('image')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-[10px] font-semibold text-sky-400 border border-slate-700 transition-all hover:scale-105 shadow-sm"
              title="Generate high-quality image from prompt"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Generate Image</span>
            </button>
            <button
              onClick={() => handleGenerateMedia('music')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-[10px] font-semibold text-emerald-400 border border-slate-700 transition-all hover:scale-105 shadow-sm"
              title="Generate custom AI music or soundtracks (Lyria)"
            >
              <Music className="w-3.5 h-3.5" />
              <span>AI Music</span>
            </button>
            <button
              onClick={() => handleGenerateMedia('video')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-[10px] font-semibold text-rose-400 border border-slate-700 transition-all hover:scale-105 shadow-sm"
              title="Generate cinematic AI video clips (Veo)"
            >
              <Video className="w-3.5 h-3.5" />
              <span>AI Video</span>
            </button>
            <div className="h-4 w-[1px] bg-slate-800 mx-1" />
            <button
              onClick={handleStartTranscription}
              disabled={isTranscribing}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold border transition-all shadow-sm ${
                isTranscribing ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700' : 'bg-slate-800/60 text-indigo-400 border-slate-700'
              }`}
              title="Start live audio transcription"
            >
              {isTranscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isTranscribing ? 'Transcribing...' : 'Live Transcribe'}</span>
            </button>
          </div>

          {/* Grounding & Search Toggle Bar */}
          <div className="flex items-center gap-2 px-1 text-xs">
            <button
              onClick={() => setEnableSearch(!enableSearch)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all font-medium border shadow-sm ${
                enableSearch
                  ? 'bg-sky-950/40 border-sky-800/60 text-sky-300'
                  : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
              title="Toggle live Google Search grounding"
            >
              <Globe className={`w-3.5 h-3.5 ${enableSearch ? 'text-sky-400' : 'text-slate-500'}`} />
              <span>Web Search {enableSearch ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => setEnableMaps(!enableMaps)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all font-medium border shadow-sm ${
                enableMaps
                  ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                  : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
              title="Toggle Google Maps grounding for places and routes"
            >
              <Map className={`w-3.5 h-3.5 ${enableMaps ? 'text-rose-400' : 'text-slate-500'}`} />
              <span>Google Maps {enableMaps ? 'ON' : 'OFF'}</span>
            </button>

            <div className="flex-1" />

            {knowledgeItems.length > 0 && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-900/50 px-2 py-1 rounded-lg border border-slate-800">
                <BookOpen className="w-3 h-3 text-indigo-400" />
                <span>{knowledgeItems.length} Knowledge Docs Active</span>
              </span>
            )}
          </div>

          <form onSubmit={handleSend} className="relative">
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={`Message OmniMind (${currentPersona.name})...`}
              rows={1}
              className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl pl-4 pr-24 py-3.5 text-sm text-slate-100 placeholder-slate-500 resize-none outline-none shadow-inner"
            />
            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleDictation}
                className={`p-2.5 rounded-xl transition-all ${
                  isDictating 
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/40' 
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
                title={isDictating ? 'Stop dictation' : 'Voice-to-Text dictation'}
              >
                {isDictating ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          <div className="text-center text-[10px] text-slate-500">
            Answers cite live sources when available. Export chat anytime to Google Sheets.
          </div>
        </div>
      </div>

      {/* Real-time Collaboration Modal */}
      <CollabModal
        isOpen={isCollabOpen}
        onClose={() => setIsCollabOpen(false)}
        roomId={session?.id || 'public-room'}
        currentUser={collabUser}
        onUpdateUserName={(name) => {
          const updated = { ...collabUser, name };
          setCollabUser(updated);
          collabRef.current?.setUser(updated);
        }}
        collaborators={collaborators}
        isConnected={isWsConnected}
      />

      {/* Knowledge Base Modal */}
      <KnowledgeBaseModal
        isOpen={isKnowledgeBaseOpen}
        onClose={() => setIsKnowledgeBaseOpen(false)}
        knowledgeItems={knowledgeItems}
        onAddKnowledgeItem={handleAddKnowledgeItem}
        onDeleteKnowledgeItem={handleDeleteKnowledgeItem}
      />

      {/* Export Preview Modal */}
      {session && (
        <ExportPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          session={session}
          onExport={handleExportFromPreview}
        />
      )}

      {/* Persona Creator Modal */}
      <PersonaModal
        isOpen={isPersonaModalOpen}
        onClose={() => setIsPersonaModalOpen(false)}
        onSave={handleSavePersona}
        onDelete={handleDeletePersona}
        customPersonas={customPersonas}
      />
    </div>
  );
};
