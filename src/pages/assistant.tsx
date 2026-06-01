import { useState, useRef, useEffect } from "react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useDeleteOpenaiConversation,
  useListOpenaiMessages,
  getListOpenaiConversationsQueryKey,
  getListOpenaiMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bot, Plus, Send, Trash2, User, Loader2, Wrench, Search, Database, Calculator, DollarSign, Link as LinkIcon, FileSearch } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { VoiceButton } from "@/components/ui/voice-button";

function MarkdownText({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-accent/40 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

interface ToolEvent { id: string; name: string; summary?: string; status: "start" | "done"; }
interface Message { role: "user" | "assistant"; content: string; streaming?: boolean; toolEvents?: ToolEvent[]; }

const TOOL_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  lookup_vendors: { label: "Looking up vendors", icon: Database },
  search_cost_history: { label: "Searching cost history", icon: FileSearch },
  list_recent_enquiries: { label: "Listing enquiries", icon: Database },
  compute_quotation_total: { label: "Computing totals", icon: Calculator },
  convert_currency: { label: "Converting currency", icon: DollarSign },
  web_search: { label: "Searching the web", icon: Search },
  fetch_url: { label: "Reading page", icon: LinkIcon },
};

function ToolChip({ event }: { event: ToolEvent }) {
  const meta = TOOL_META[event.name] ?? { label: event.name, icon: Wrench };
  const Icon = meta.icon;
  const isDone = event.status === "done";
  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border ${isDone ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-accent/30 text-muted-foreground"}`}>
      {isDone ? <Icon aria-hidden="true" className="w-3 h-3" /> : <Loader2 aria-hidden="true" className="w-3 h-3 animate-spin" />}
      <span className="font-medium">{meta.label}</span>
      {isDone && event.summary && <span className="opacity-70">· {event.summary}</span>}
    </div>
  );
}

export default function Assistant() {
  const { data: conversations, isLoading: convsLoading } = useListOpenaiConversations();
  const createConversation = useCreateOpenaiConversation();
  const deleteConversation = useDeleteOpenaiConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const { data: dbMessages } = useListOpenaiMessages(activeConvId!, { query: { enabled: !!activeConvId, queryKey: activeConvId ? getListOpenaiMessagesQueryKey(activeConvId) : [] } });
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const voice = useVoiceInput({
    onResult: (transcript) => {
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
    },
  });

  const messages: Message[] = localMessages.length > 0
    ? localMessages
    : (dbMessages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setLocalMessages([]);
  }, [activeConvId]);

  async function handleNewConversation() {
    const conv = await createConversation.mutateAsync({
      data: { title: "New conversation" },
    });
    queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    setActiveConvId(conv.id);
    setLocalMessages([]);
    setInput("");
  }

  async function handleDeleteConversation(id: number) {
    await deleteConversation.mutateAsync({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (activeConvId === id) { setActiveConvId(null); setLocalMessages([]); }
      },
      onError: () => toast({ title: "Error deleting conversation", variant: "destructive" }),
    });
  }

  async function handleSend() {
    if (!input.trim() || streaming) return;

    let convId = activeConvId;
    if (!convId) {
      const conv = await createConversation.mutateAsync({ data: { title: input.slice(0, 50) } });
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      convId = conv.id;
      setActiveConvId(convId);
    }

    const userMsg: Message = { role: "user", content: input };
    const assistantMsg: Message = { role: "assistant", content: "", streaming: true, toolEvents: [] };
    setLocalMessages((prev) => {
      const base = prev.length > 0 ? prev : (dbMessages ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      return [...base, userMsg, assistantMsg];
    });
    setInput("");
    setStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const resp = await fetch(`${base}/api/openai/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg.content }),
        signal: abort.signal,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      const handleEvent = (rawEvent: string) => {
        // SSE event: one or more "data: ..." lines joined by \n
        const dataLines = rawEvent
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).replace(/^ /, ""));
        if (dataLines.length === 0) return;
        const payload = dataLines.join("\n");
        let data: { content?: string; tool?: { id?: string; name: string; status: "start" | "done"; summary?: string }; error?: string; done?: boolean };
        try { data = JSON.parse(payload); } catch { return; }

        if (data.content) {
          accumulated += data.content;
          setLocalMessages((prev) => {
            const next = [...prev];
            const last = next.length > 0 ? next[next.length - 1] : undefined;
            const updated: Message = { ...(last ?? {}), role: "assistant", content: accumulated, streaming: true };
            if (last && last.role === "assistant") next[next.length - 1] = updated;
            else next.push(updated);
            return next;
          });
        }
        if (data.tool) {
          const t = data.tool;
          const evt: ToolEvent = { id: t.id ?? `${t.name}-${Date.now()}-${Math.random()}`, name: t.name, status: t.status, summary: t.summary };
          setLocalMessages((prev) => {
            const next = [...prev];
            const last = next.length > 0 ? next[next.length - 1] : undefined;
            const baseEvents = last?.toolEvents ?? [];
            const events = [...baseEvents];
            if (evt.status === "done") {
              const idx = events.findIndex((e) => e.id === evt.id);
              if (idx >= 0) events[idx] = evt;
              else events.push(evt);
            } else {
              events.push(evt);
            }
            const updated: Message = { ...(last ?? { role: "assistant", content: accumulated }), toolEvents: events, streaming: true };
            if (last && last.role === "assistant") next[next.length - 1] = updated;
            else next.push(updated);
            return next;
          });
        }
        if (data.error) {
          accumulated += `\n\n_Error: ${data.error}_`;
        }
        if (data.done) {
          setLocalMessages((prev) => {
            const next = [...prev];
            const last = next.length > 0 ? next[next.length - 1] : undefined;
            const updated: Message = { ...(last ?? {}), role: "assistant", content: accumulated, streaming: false };
            if (last && last.role === "assistant") next[next.length - 1] = updated;
            else next.push(updated);
            return next;
          });
          queryClient.invalidateQueries({ queryKey: getListOpenaiMessagesQueryKey(convId!) });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // flush any trailing event
          const tail = buffer.trim();
          if (tail) handleEvent(tail);
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        // SSE events are separated by a blank line (\n\n)
        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          if (rawEvent.trim()) handleEvent(rawEvent);
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast({ title: "Error communicating with assistant", variant: "destructive" });
        setLocalMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-0 bg-card border border-card-border rounded-xl overflow-hidden animate-in fade-in duration-300">
      {/* Sidebar */}
      <div className="w-60 shrink-0 border-r border-card-border flex flex-col bg-sidebar">
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Conversations</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewConversation} disabled={createConversation.isPending} data-testid="button-new-conversation">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {convsLoading ? (
            <div className="p-3 space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : !conversations || conversations.length === 0 ? (
            <div className="px-4 py-8 text-xs text-muted-foreground text-center">No conversations yet. Start chatting below.</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 px-3 py-2.5 mx-2 rounded-md cursor-pointer transition-colors ${activeConvId === conv.id ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`}
                onClick={() => setActiveConvId(conv.id)}
                data-testid={`conv-item-${conv.id}`}
              >
                <Bot className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                <span className="text-xs flex-1 truncate">{conv.title}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                  onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                  data-testid={`button-delete-conv-${conv.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-card-border flex items-center gap-3">
          <Bot className="w-5 h-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">Smart Assistant</div>
            <div className="text-xs text-muted-foreground">Vendor lookup · Cost history · Web pricing · Live FX · VAT</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <Bot className="w-12 h-12 text-primary/30" />
              <div>
                <div className="text-foreground font-semibold mb-1">The Agency Smart Assistant</div>
                <div className="text-sm text-muted-foreground max-w-md">
                  I can look up your vendors, check what you've charged before, search live market prices, do FX conversions, and compute quotation totals with VAT.
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
                {[
                  "What have we charged for LED screens before?",
                  "Find current market price for 10x10m stage truss in Oman",
                  "Quote: 2x LED wall @ 450 OMR, 1x sound system @ 800 OMR, 4x staff @ 35 OMR each",
                  "Convert 12,500 USD to OMR at today's rate",
                  "Which vendors do we have for catering?",
                ].map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`message-${i}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent/30 border border-border text-foreground"}`}>
                {msg.role === "assistant" ? (
                  <div className="space-y-2">
                    {msg.toolEvents && msg.toolEvents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.toolEvents.map((e, j) => <ToolChip key={`${j}-${e.name}-${e.status}`} event={e} />)}
                      </div>
                    )}
                    {(msg.content || !msg.streaming) && (
                      <span>
                        <MarkdownText text={msg.content} />
                        {msg.streaming && msg.content && <span className="inline-block w-1.5 h-4 bg-primary ml-1 animate-pulse rounded-sm" />}
                      </span>
                    )}
                    {msg.streaming && !msg.content && (!msg.toolEvents || msg.toolEvents.length === 0) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                      </div>
                    )}
                  </div>
                ) : msg.content}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-accent/50 border border-border flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-card-border">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              placeholder="Ask about pricing, vendors, totals, or search the web for material costs..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="resize-none flex-1 min-h-[44px] max-h-32"
              disabled={streaming}
              data-testid="input-chat-message"
            />
            <VoiceButton
              isListening={voice.isListening}
              isSupported={voice.isSupported}
              onClick={voice.toggle}
              className="h-11 w-11"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || streaming}
              className="bg-primary text-primary-foreground shrink-0 h-11 w-11 p-0"
              data-testid="button-send-message"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {voice.isListening && (
            <p className="text-xs text-red-400 mt-1.5 animate-pulse">Listening... speak now</p>
          )}
        </div>
      </div>
    </div>
  );
}
