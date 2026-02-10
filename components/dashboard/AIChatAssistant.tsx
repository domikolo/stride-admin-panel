/**
 * AI Chat Assistant Component
 * Connects to backend chat API, loads history on mount
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Sparkles } from 'lucide-react';
import { sendChatMessage, getChatHistory } from '@/lib/api';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface AIChatAssistantProps {
    clientId: string;
}

const SUGGESTED_QUESTIONS = [
    'Jakie byly najczestsze pytania wczoraj?',
    'Ile kosztowaly rozmowy w tym tygodniu?',
    'Pokaz luki w bazie wiedzy',
];

export default function AIChatAssistant({ clientId }: AIChatAssistantProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [historyLoaded, setHistoryLoaded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Load chat history on mount
    useEffect(() => {
        if (!clientId || historyLoaded) return;

        const loadHistory = async () => {
            try {
                const data = await getChatHistory(clientId, 50);
                if (data.messages && data.messages.length > 0) {
                    setMessages(
                        data.messages.map((msg) => ({
                            role: msg.role,
                            content: msg.content,
                            timestamp: msg.timestamp,
                        }))
                    );
                }
            } catch (err) {
                console.error('Failed to load chat history:', err);
            } finally {
                setHistoryLoaded(true);
            }
        };

        loadHistory();
    }, [clientId, historyLoaded]);

    useEffect(() => {
        if (messages.length > 0) {
            scrollToBottom();
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !clientId) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await sendChatMessage(clientId, userMessage.content);

            const assistantMessage: ChatMessage = {
                role: 'assistant',
                content: response.message,
                timestamp: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: 'Przepraszam, wystapil blad. Sprobuj ponownie.',
                timestamp: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionClick = (question: string) => {
        setInput(question);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Card className="glass-card p-4 flex flex-col h-[400px]">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                    <Sparkles size={18} className="text-blue-400" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-white">AI Chat Assistant</h3>
                    <p className="text-xs text-zinc-500">Zapytaj o dane</p>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                        <p className="text-zinc-500 text-sm mb-4">
                            Zapytaj mnie o cokolwiek zwi&#261;zanego z Twoimi danymi
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            {SUGGESTED_QUESTIONS.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSuggestionClick(q)}
                                    className="text-xs bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white px-3 py-1.5 rounded-full transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${msg.role === 'user'
                                    ? 'bg-blue-500/20 text-blue-100'
                                    : 'bg-white/5 text-zinc-300'
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))
                )}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white/5 text-zinc-400 px-3 py-2 rounded-lg text-sm">
                            <span className="animate-pulse">&#9679;&#9679;&#9679;</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Wpisz pytanie..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
                    disabled={isLoading}
                />
                <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    size="sm"
                    className="px-4"
                >
                    <Send size={16} />
                </Button>
            </div>
        </Card>
    );
}
