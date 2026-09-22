import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { BrainstormLab } from './components/BrainstormLab';
import { SheetsHub } from './components/SheetsHub';
import { ChatSession, Message } from './types';
import { AuthProvider, useAuth } from './components/AuthProvider';

function AppContent() {
  const { user, loading, signIn, logout } = useAuth();
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('omnimind_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        id: '1',
        title: 'Welcome to OmniMind AI',
        messages: [
          {
            id: 'm1',
            role: 'model',
            content: 'Hello! I am OmniMind AI, your advanced assistant for ideas, answers, and creative insights. How can I help you today? You can also export any chat or brainstormed ideas directly to Google Sheets!',
            timestamp: Date.now(),
          },
        ],
        updatedAt: Date.now(),
        model: 'gemini-3.8-flash',
        personaId: 'assistant',
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessions[0]?.id || null);
  const [activeTab, setActiveTab] = useState<'chat' | 'brainstorm' | 'sheets'>('chat');

  useEffect(() => {
    localStorage.setItem('omnimind_sessions', JSON.stringify(sessions));
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Conversation',
      messages: [],
      updatedAt: Date.now(),
      model: 'gemini-3.8-flash',
      personaId: 'assistant',
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setActiveTab('chat');
  };

  const handleCreateNewSessionWithFirstMessage = (text: string, modelToUse: string = 'gemini-3.8-flash') => {
    const title = text.length > 30 ? text.slice(0, 30) + '...' : text;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title,
      messages: [userMsg],
      updatedAt: Date.now(),
      model: modelToUse,
      personaId: 'assistant',
    };

    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);

    // Call API for response
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: [],
        model: modelToUse,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        const modelMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: data.content || 'No response generated.',
          timestamp: Date.now(),
          sources: data.sources,
        };
        setSessions((prev) =>
          prev.map((s) => (s.id === newSession.id ? { ...s, messages: [...s.messages, modelMsg] } : s))
        );
      })
      .catch((err) => {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `⚠️ Error: ${err.message || 'Failed to communicate with AI server.'}`,
          timestamp: Date.now(),
        };
        setSessions((prev) =>
          prev.map((s) => (s.id === newSession.id ? { ...s, messages: [...s.messages, errorMsg] } : s))
        );
      });
  };

  const handleUpdateSessionMessages = (sessionId: string, newMessages: Message[]) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === sessionId) {
          let title = s.title;
          if (s.title === 'New Conversation' && newMessages.length > 0) {
            const firstUserMsg = newMessages.find((m) => m.role === 'user');
            if (firstUserMsg) {
              title = firstUserMsg.content.length > 30 ? firstUserMsg.content.slice(0, 30) + '...' : firstUserMsg.content;
            }
          }
          return { ...s, messages: newMessages, title, updatedAt: Date.now() };
        }
        return s;
      })
    );
  };

  const handleUpdateSessionModel = (sessionId: string, newModel: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, model: newModel, updatedAt: Date.now() } : s))
    );
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    setSessions(filtered);
    if (activeSessionId === sessionId) {
      setActiveSessionId(filtered[0]?.id || null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-slate-400">Loading OmniMind AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setActiveTab('chat');
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        needsAuth={false}
        onLogin={signIn}
        onLogout={logout}
      />

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {activeTab === 'chat' && (
          <ChatArea
            session={activeSession}
            onUpdateSessionMessages={handleUpdateSessionMessages}
            onCreateNewSessionWithFirstMessage={handleCreateNewSessionWithFirstMessage}
            onUpdateSessionModel={handleUpdateSessionModel}
            user={user}
            onLogin={signIn}
          />
        )}
        {activeTab === 'brainstorm' && <BrainstormLab user={user} onLogin={signIn} />}
        {activeTab === 'sheets' && (
          <SheetsHub
            user={user}
            onLogin={signIn}
            onLogout={logout}
            setActiveTab={setActiveTab}
            activeSession={activeSession}
            sessions={sessions}
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
