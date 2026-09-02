import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Bot,
  User as UserIcon,
  HelpCircle,
  Minimize2,
  Trash2,
} from 'lucide-react';
import { sendChatMessage } from '../services/api';
import { ChatMessage, SuggestedProject } from '../types';

const PROMPT_SUGGESTIONS = [
  'Which projects have the highest risk?',
  'Which sector has the highest cost overrun?',
  'Which projects have low physical progress?',
  'What are the biggest risks in the portfolio?',
  'What intervention should be considered for delayed projects?',
];

export const AIAssistantChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<string>('Thinking...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      setLoadingText('Thinking...');
      timer = setTimeout(() => {
        setLoadingText('Thinking a little longer...');
      }, 10000);
    } else {
      setLoadingText('Thinking...');
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Detect if user is viewing a specific project detail page
  const projectDetailMatch = location.pathname.match(/^\/projects\/([a-zA-Z0-9_-]+)$/);
  const currentProjectId = projectDetailMatch ? projectDetailMatch[1] : undefined;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'msg-init',
          role: 'model',
          text: 'Hello! I am **Project Sentinel AI**, your infrastructure intelligence assistant. I analyze live project telemetry, cost overruns, timeline delays, and critical alerts across the portfolio.\n\nHow can I assist your monitoring review today?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, []);

  const handleSend = async (userText?: string) => {
    const textToSend = (userText || input).trim();
    if (!textToSend || loading) return;

    setErrorMessage(null);
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      // Pass past conversational history (excluding errors)
      const historyPayload = newHistory
        .filter((m) => !m.isError && m.id !== 'msg-init')
        .map((m) => ({
          role: m.role,
          text: m.text,
        }));

      const res = await sendChatMessage(textToSend, historyPayload, currentProjectId);

      const botMsg: ChatMessage = {
        id: `msg-${Date.now()}-bot`,
        role: 'model',
        text: res.reply,
        suggestedProjects: res.suggestedProjects,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('[AI Chatbot UI Error]:', err);
      const errMsg = err.message || 'Failed to communicate with AI Assistant.';
      setErrorMessage(errMsg);

      const errorBotMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'model',
        text: `⚠️ **AI Service Notice:** ${errMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorBotMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: `msg-${Date.now()}-reset`,
        role: 'model',
        text: 'Conversation history cleared. Live portfolio telemetry is loaded. What would you like to analyze?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setErrorMessage(null);
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  return (
    <>
      {/* Floating Action Button (Zero disturbance to existing UI) */}
      {!isOpen && (
        <button
          id="btn-open-ai-assistant"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-5 py-3.5 text-sm font-bold text-white shadow-xl shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-105 active:scale-95 transition-all focus:outline-hidden"
          aria-label="Open AI Assistant"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-300 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
          </span>
          <Sparkles className="h-4 w-4" />
          <span>Sentinel AI Assistant</span>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          id="ai-assistant-modal"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col w-[94vw] sm:w-[440px] h-[600px] max-h-[85vh] rounded-2xl bg-white border border-slate-200/90 shadow-2xl shadow-slate-900/25 overflow-hidden transition-all duration-200 font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/30 border border-blue-400/30 text-blue-300 shadow-xs">
                <Sparkles className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold tracking-wide uppercase text-slate-200">
                    Sentinel AI Assistant
                  </h3>
                  <span className="flex items-center gap-1 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-emerald-300 border border-emerald-400/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {currentProjectId ? `Project Context: ${currentProjectId}` : 'Portfolio-Wide Telemetry'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={handleClearChat}
                title="Clear Chat History"
                className="rounded-lg p-1.5 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                aria-label="Clear Chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize"
                className="rounded-lg p-1.5 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Active Project Context Banner */}
          {currentProjectId && (
            <div className="flex items-center justify-between bg-blue-50/80 px-3.5 py-1.5 border-b border-blue-100 text-[11px] text-blue-900">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                <span>Grounded on active project telemetry</span>
              </div>
              <button
                onClick={() => handleSend(`Give me an in-depth risk analysis of project ${currentProjectId}`)}
                className="font-bold underline hover:text-blue-700"
              >
                Analyze Project
              </button>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                        : m.isError
                        ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-bl-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {/* Message Text with basic markdown support */}
                    <div className="space-y-1.5 whitespace-pre-wrap">
                      {m.text.split('\n').map((paragraph, pIdx) => {
                        if (!paragraph.trim()) return <div key={pIdx} className="h-1" />;
                        return (
                          <p key={pIdx}>
                            {paragraph.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                              if (part.startsWith('**') && part.endsWith('**')) {
                                return (
                                  <strong key={i} className="font-bold">
                                    {part.slice(2, -2)}
                                  </strong>
                                );
                              }
                              return part;
                            })}
                          </p>
                        );
                      })}
                    </div>

                    {/* Dynamic Suggested Projects */}
                    {m.suggestedProjects && m.suggestedProjects.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Referenced Infrastructure Projects:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.suggestedProjects.map((sp) => (
                            <button
                              key={sp.id}
                              onClick={() => handleProjectClick(sp.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:border-blue-200 px-2 py-1 text-[10px] font-semibold text-slate-800 border border-slate-200 transition-colors"
                            >
                              <span>{sp.project_name.slice(0, 22)}...</span>
                              <span
                                className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                                  sp.risk_level === 'HIGH'
                                    ? 'bg-rose-100 text-rose-700'
                                    : sp.risk_level === 'MEDIUM'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {sp.risk_level}
                              </span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-[9px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-600 w-fit shadow-xs">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600" />
                <span className="font-medium text-[11px] transition-all duration-300">
                  {loadingText}
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips (when 2 or fewer messages) */}
          {messages.length <= 3 && !loading && (
            <div className="px-3 py-2 bg-slate-100/70 border-t border-slate-200/80 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5">
              {PROMPT_SUGGESTIONS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(prompt)}
                  className="rounded-full bg-white border border-slate-200/90 px-2.5 py-1 text-[10px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50/50 transition-colors shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Missing API Key Warning if triggered */}
          {errorMessage && (errorMessage.includes('API_KEY') || errorMessage.includes('API Key')) && (
            <div className="px-3 py-2 bg-rose-50 border-t border-rose-200 text-[11px] text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>
                <strong>Configuration Missing:</strong> Please set a valid API key in your <code>.env</code> file.
              </span>
            </div>
          )}

          {/* Input Bar */}
          <div className="p-3 bg-white border-t border-slate-200">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="Ask about project risks, cost overruns, delays..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-3.5 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-all"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="absolute right-1.5 rounded-lg p-1.5 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 transition-colors focus:outline-hidden"
                aria-label="Send Message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1 text-[9px] text-slate-400">
              <span>Grounded in actual MoSPI/PAIMANA telemetry</span>
              <span>Enter to send</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
