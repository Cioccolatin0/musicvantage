import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import SafeImg from "@/components/SafeImg";
import GroupLeaderboard from "@/components/GroupLeaderboard";
import AdVANTAGEModal from "@/components/AdVANTAGEModal";
import ContextMenu from "@/components/ContextMenu";
import FriendActivitySection from "@/components/FriendActivitySection";
import {
  MessageCircle, Send, Music, ListMusic, Mic, Play, X, ArrowLeft,
  Loader2, Users, Smile, Paperclip, Image, UserPlus, Settings2, LogOut,
  ChevronDown, Circle, UserMinus, UserCheck, Trophy, Trash2
} from "lucide-react";
import { toast } from "sonner";

export default function Chat() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/chat/:conversationId?");
  const conversationId = params?.conversationId ? parseInt(params.conversationId) : null;

  const { data: conversations = [], refetch: refetchConvs } = trpc.chat.conversations.useQuery(undefined, { enabled: !!user });
  const [selectedConv, setSelectedConv] = useState<number | null>(conversationId);
  const [message, setMessage] = useState("");
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [musicSearch, setMusicSearch] = useState("");
  const [debouncedMusicSearch, setDebouncedMusicSearch] = useState("");
  const musicSearchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; convId: number } | null>(null);
  const [confirmClose, setConfirmClose] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conversationId) setSelectedConv(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (musicSearchTimerRef.current) clearTimeout(musicSearchTimerRef.current);
    musicSearchTimerRef.current = setTimeout(() => {
      setDebouncedMusicSearch(musicSearch.trim());
    }, 200);
    return () => { if (musicSearchTimerRef.current) clearTimeout(musicSearchTimerRef.current); };
  }, [musicSearch]);

  const { data: messages = [], refetch: refetchMsgs } = trpc.chat.messages.useQuery(
    { conversationId: selectedConv || 0, limit: 100 },
    { enabled: !!selectedConv && !!user, refetchInterval: 3000 }
  );

  const { data: searchResults } = trpc.music.searchAll.useQuery(
    { query: debouncedMusicSearch },
    { enabled: debouncedMusicSearch.length >= 2, staleTime: 5 * 60 * 1000, placeholderData: (prev: any) => prev }
  );

  const { data: friends = [] } = trpc.friends.list.useQuery(undefined, { enabled: !!user });
  const { data: allUsers = [] } = trpc.friends.all.useQuery(undefined, { enabled: !!user && (showCreateGroup || showGroupPanel) });
  const { data: friendActivity = [] } = trpc.social.friendActivity.useQuery(undefined, { enabled: !!user, refetchInterval: 10000 });

  const getFriendActivity = (userId: number) => friendActivity.find((a: any) => a.userId === userId);

  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => { setMessage(""); refetchMsgs(); refetchConvs(); },
    onError: (err) => toast.error(err.message),
  });

  const closeConvMutation = trpc.chat.close.useMutation({
    onSuccess: () => {
      if (selectedConv === confirmClose) { setSelectedConv(null); navigate("/chat"); }
      setConfirmClose(null);
      refetchConvs();
      toast.success("Conversazione chiusa");
    },
    onError: (err) => toast.error(err.message),
  });

  const createConvMutation = trpc.chat.getOrCreateConversation.useMutation({
    onSuccess: (data) => { setSelectedConv(data.id); navigate(`/chat/${data.id}`); },
  });

  const createGroupMutation = trpc.chat.createGroup.useMutation({
    onSuccess: (data) => {
      setShowCreateGroup(false);
      setGroupName("");
      setSelectedMembers([]);
      setSelectedConv(data.id);
      navigate(`/chat/${data.id}`);
      refetchConvs();
      toast.success("Gruppo creato!");
    },
    onError: (err) => toast.error(err.message),
  });

  const addToGroupMutation = trpc.chat.addUserToGroup.useMutation({
    onSuccess: () => { refetchConvs(); toast.success("Utente aggiunto"); },
    onError: (err) => toast.error(err.message),
  });

  const removeFromGroupMutation = trpc.chat.removeUserFromGroup.useMutation({
    onSuccess: () => { refetchConvs(); toast.success("Utente rimosso"); },
    onError: (err) => toast.error(err.message),
  });

  const leaveGroupMutation = trpc.chat.leaveGroup.useMutation({
    onSuccess: () => {
      setSelectedConv(null);
      navigate("/chat");
      refetchConvs();
      toast.success("Gruppo abbandonato");
    },
    onError: (err) => toast.error(err.message),
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const handleSend = () => {
    if (!selectedConv || !message.trim()) return;
    sendMutation.mutate({ conversationId: selectedConv, type: "text", content: message.trim() });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleShareMusic = (track: any) => {
    if (!selectedConv) return;
    sendMutation.mutate({
      conversationId: selectedConv,
      type: "music",
      content: `🎵 ${track.title} - ${track.artist}`,
      musicData: { trackId: track.id, title: track.title, artist: track.artist, thumbnail: track.thumbnail },
    });
    setShowMusicPicker(false);
    setMusicSearch("");
  };

  const toggleMember = (id: number) => {
    setSelectedMembers((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  if (!user) {
    return (
      <div className="container py-24 text-center fade-in">
        <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" strokeWidth={1.5} />
        <p className="text-muted-foreground text-sm">Accedi per chattare con gli amici</p>
      </div>
    );
  }

  const currentConv = conversations.find((c: any) => c.id === selectedConv);
  const isGroup = currentConv?.type === "group";
  const isAdmin = currentConv?.adminUserId === user.id;
  const otherParticipants = (currentConv?.participants || []).filter((p: any) => p.id !== user.id);

  return (
    <div className="flex flex-1 min-h-0 fade-in">
      {/* Conversation list */}
      <div className={`w-full sm:w-80 lg:w-96 border-r border-border/30 flex flex-col ${selectedConv ? "hidden sm:flex" : "flex"}`}>
        <div className="p-4 border-b border-border/20 flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Chat
          </h2>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-spotify-green hover:bg-surface-1 transition-colors"
            title="Crea gruppo"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!selectedConv && (
            <div className="p-4 border-b border-border/20">
              <FriendActivitySection />
            </div>
          )}
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <p>Nessuna conversazione</p>
              <p className="mt-1 text-xs">Aggiungi amici per iniziare a chattare</p>
            </div>
          ) : (
            conversations.map((conv: any) => {
              const other = conv.participants?.find((p: any) => p.id !== user.id);
              const isActive = conv.id === selectedConv;
              const isGroup = conv.type === "group";
              return (
                <div key={conv.id} className="relative group/item">
                  <button
                    onClick={() => { setSelectedConv(conv.id); navigate(`/chat/${conv.id}`); }}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, convId: conv.id }); }}
                    className={`w-full flex items-center gap-3 p-4 border-b border-border/10 hover:bg-surface-1 transition-colors text-left ${isActive ? "bg-surface-1" : ""}`}
                  >
                    <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                      style={{ background: isGroup ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(var(--spotify-green), 0.2)" }}>
                      {!isGroup && other?.photo ? <SafeImg src={other.photo} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {isGroup ? (conv.name || "Gruppo") : (other?.name || "Sconosciuto")}
                      </p>
                      {!isGroup && other && getFriendActivity(other.id) ? (
                        <p className="text-xs text-spotify-green truncate mt-0.5">
                          🎵 {getFriendActivity(other.id).trackTitle}
                        </p>
                      ) : conv.lastMessage ? (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage.content}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {conv.lastMessage && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap hidden sm:inline">
                          {new Date(conv.lastMessage.createdAt).toLocaleDateString("it-IT")}
                        </span>
                      )}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); setConfirmClose(conv.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setConfirmClose(conv.id); } }}
                        className="sm:hidden p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover/item:opacity-100 cursor-pointer"
                        title="Chiudi conversazione"
                      >
                        <X className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${!selectedConv ? "hidden sm:flex" : "flex"}`}>
        {!selectedConv ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-30" strokeWidth={1.5} />
              <p className="text-sm">Seleziona una conversazione</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 p-3 border-b border-border/20 bg-background/80 backdrop-blur-sm">
              <button onClick={() => { setSelectedConv(null); navigate("/chat"); }} className="sm:hidden p-1">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden shrink-0"
                style={{ background: isGroup ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(var(--spotify-green), 0.2)" }}>
                {!isGroup && otherParticipants[0]?.photo ? <SafeImg src={otherParticipants[0].photo} alt="" className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {isGroup ? (currentConv?.name || "Gruppo") : (otherParticipants[0]?.name || "Sconosciuto")}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {isGroup
                    ? `${currentConv?.participants?.length || 0} partecipanti`
                    : otherParticipants[0] && getFriendActivity(otherParticipants[0].id)
                      ? `🎵 ${getFriendActivity(otherParticipants[0].id).trackTitle} — ${getFriendActivity(otherParticipants[0].id).trackArtist}`
                      : "Online"}
                </p>
              </div>
              {isGroup && (
                <button
                  onClick={() => setShowGroupPanel(!showGroupPanel)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
              {!isGroup && otherParticipants[0] && (
                <button
                  onClick={() => navigate(`/profile/${otherParticipants[0].id}`)}
                  className="text-xs text-spotify-green hover:underline"
                >
                  Profilo
                </button>
              )}
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg: any) => {
                  const isMine = msg.senderId === user.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} items-end gap-2`}>
                      {!isMine && isGroup && (
                        <div className="w-6 h-6 rounded-full bg-surface-1 flex items-center justify-center shrink-0 text-[9px] font-medium text-muted-foreground">
                          {msg.senderName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className={`max-w-[80%] sm:max-w-[65%]`}>
                        {!isMine && isGroup && (
                          <p className="text-[10px] text-muted-foreground ml-1 mb-0.5">{msg.senderName}</p>
                        )}
                        {msg.type === "text" && (
                          <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                            isMine
                              ? "bg-blue-600 text-white rounded-br-md"
                              : "bg-spotify-green text-white rounded-bl-md"
                          }`}>
                            <p>{msg.content}</p>
                            <p className="text-[10px] mt-1 opacity-70">
                              {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        )}
                        {msg.type === "music" && <MusicMessage msg={msg} isMine={isMine} />}
                        {msg.type === "playlist" && <PlaylistMessage msg={msg} isMine={isMine} />}
                        {msg.type === "voice" && <VoiceMessage msg={msg} isMine={isMine} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Group panel */}
              {isGroup && showGroupPanel && (
                <div className="w-72 border-l border-border/30 bg-background/80 backdrop-blur-sm overflow-y-auto p-4 hidden sm:block">
                  <div className="border-b border-border/20 pb-3 mb-3">
                    <h3 className="font-semibold text-sm mb-3">Partecipanti ({currentConv?.participants?.length})</h3>
                    <div className="space-y-2">
                      {currentConv?.participants?.map((p: any) => {
                        const isAdminUser = p.id === currentConv.adminUserId;
                        return (
                          <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-1 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-surface-1 flex items-center justify-center shrink-0 overflow-hidden">
                              {p.photo ? <SafeImg src={p.photo} alt="" className="w-full h-full object-cover" /> : <Users className="w-3.5 h-3.5 text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{p.name}</p>
                              {isAdminUser && <p className="text-[10px] text-spotify-green">Admin</p>}
                            </div>
                            {isAdmin && p.id !== user.id && (
                              <button
                                onClick={() => removeFromGroupMutation.mutate({ conversationId: selectedConv!, userId: p.id })}
                                className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
                                title="Rimuovi"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-b border-border/20 pb-3 mb-3">
                    <GroupLeaderboard conversationId={selectedConv!} groupName={currentConv?.name} />
                  </div>

                  {isAdmin && (
                    <>
                      <div className="relative mb-3">
                        <input
                          type="text"
                          value={addMemberSearch}
                          onChange={(e) => setAddMemberSearch(e.target.value)}
                          placeholder="Aggiungi membro..."
                          className="w-full bg-surface-1 rounded-lg px-3 py-2 text-sm outline-none"
                        />
                      </div>
                      {addMemberSearch && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {allUsers
                            .filter((u: any) => !currentConv?.participants?.some((p: any) => p.id === u.id) && (u.name?.toLowerCase().includes(addMemberSearch.toLowerCase()) || u.email?.toLowerCase().includes(addMemberSearch.toLowerCase())))
                            .slice(0, 5)
                            .map((u: any) => (
                              <button
                                key={u.id}
                                onClick={() => { addToGroupMutation.mutate({ conversationId: selectedConv!, userId: u.id }); setAddMemberSearch(""); }}
                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-surface-1 transition-colors text-left"
                              >
                                <UserPlus className="w-3.5 h-3.5 text-spotify-green" />
                                <span className="text-sm">{u.name}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (confirm("Abbandonare il gruppo?")) {
                        leaveGroupMutation.mutate({ conversationId: selectedConv! });
                      }
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors mt-4"
                  >
                    <LogOut className="w-4 h-4" />
                    Abbandona gruppo
                  </button>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/20 bg-background/80 backdrop-blur-sm">
              {showMusicPicker && (
                <div className="mb-3 p-3 rounded-xl bg-surface-1 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={musicSearch}
                      onChange={(e) => setMusicSearch(e.target.value)}
                      placeholder="Cerca un brano da condividere..."
                      className="flex-1 bg-surface-2 rounded-lg px-3 py-2 text-sm outline-none"
                      autoFocus
                    />
                    <button onClick={() => { setShowMusicPicker(false); setMusicSearch(""); }} className="text-muted-foreground p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {searchResults?.tracks?.slice(0, 5).map((track: any) => (
                    <button
                      key={track.id}
                      onClick={() => handleShareMusic(track)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-surface-2 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-surface-2 shrink-0">
                        <SafeImg src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-xs font-medium truncate">{track.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{track.artist}</p>
                      </div>
                      <Music className="w-3.5 h-3.5 text-spotify-green shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMusicPicker(!showMusicPicker)}
                  className={`p-2 rounded-lg transition-colors ${showMusicPicker ? "bg-spotify-green text-black" : "text-muted-foreground hover:text-foreground hover:bg-surface-1"}`}
                >
                  <Music className="w-5 h-5" />
                </button>
                <button
                  onClick={() => toast.info("Usa il microfono per registrare un vocale")}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors"
                >
                  <Mic className="w-5 h-5" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Scrivi un messaggio..."
                    rows={1}
                    className="w-full bg-surface-1 rounded-xl px-4 py-2.5 text-sm outline-none resize-none max-h-32"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!message.trim() || sendMutation.isPending}
                  className="p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-50 transition-opacity hover:bg-blue-700"
                >
                  {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "Chiudi conversazione",
              icon: <Trash2 className="w-4 h-4" />,
              danger: true,
              onClick: () => { setConfirmClose(contextMenu.convId); },
            },
          ]}
        />
      )}

      {/* Confirm Close Dialog */}
      {confirmClose !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmClose(null)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm mx-4 border border-border/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Chiudi conversazione?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              La conversazione verr&agrave; rimossa dalla tua lista. Questa azione non pu&ograve; essere annullata.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmClose(null)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-1 text-sm hover:bg-surface-2 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => closeConvMutation.mutate({ conversationId: confirmClose })}
                disabled={closeConvMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {closeConvMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Dialog */}
      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateGroup(false)}>
          <div className="bg-card rounded-2xl p-6 w-full max-w-md mx-4 border border-border/30 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Crea gruppo</h3>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nome del gruppo..."
              className="w-full bg-surface-1 rounded-xl px-4 py-2.5 text-sm outline-none mb-4"
              autoFocus
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground mb-3">Aggiungi membri (massimo 10 totali):</p>
            <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
              {friends.map((f: any) => (
                <button
                  key={f.id}
                  onClick={() => toggleMember(f.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors ${
                    selectedMembers.includes(f.id) ? "bg-spotify-green/10 border border-spotify-green/30" : "hover:bg-surface-1"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedMembers.includes(f.id) ? "bg-spotify-green border-spotify-green" : "border-border"
                  }`}>
                    {selectedMembers.includes(f.id) && <UserCheck className="w-3 h-3 text-black" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateGroup(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-surface-1 text-sm hover:bg-surface-2 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => createGroupMutation.mutate({ name: groupName, participantIds: selectedMembers })}
                disabled={!groupName.trim() || selectedMembers.length === 0 || createGroupMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-spotify-green text-black text-sm font-medium hover:bg-spotify-green/90 transition-colors disabled:opacity-60"
              >
                {createGroupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Crea gruppo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MusicMessage({ msg, isMine }: { msg: any; isMine: boolean }) {
  const { playTrack } = usePlayer();
  return (
    <div className={`rounded-2xl overflow-hidden ${isMine ? "bg-blue-600" : "bg-spotify-green"}`}>
      {msg.musicData && (
        <button
          onClick={() => playTrack({
            id: msg.musicData.trackId,
            title: msg.musicData.title,
            artist: msg.musicData.artist,
            thumbnail: msg.musicData.thumbnail,
            type: "track",
          })}
          className="w-full flex items-center gap-3 p-3 text-white text-left"
        >
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/20 shrink-0">
            <SafeImg src={msg.musicData.thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{msg.musicData.title}</p>
            <p className="text-xs opacity-80 truncate">{msg.musicData.artist}</p>
          </div>
          <Play className="w-5 h-5 shrink-0" />
        </button>
      )}
      <p className="text-[10px] px-3 pb-2 opacity-70 text-white">
        {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

function PlaylistMessage({ msg, isMine }: { msg: any; isMine: boolean }) {
  const [, navigate] = useLocation();
  return (
    <div className={`rounded-2xl overflow-hidden ${isMine ? "bg-blue-600" : "bg-spotify-green"}`}>
      <button
        onClick={() => navigate(`/playlist/${msg.playlistData?.playlistId}`)}
        className="w-full flex items-center gap-3 p-3 text-white text-left"
      >
        <div className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center shrink-0">
          <ListMusic className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{msg.playlistData?.name}</p>
          <p className="text-xs opacity-80">{msg.playlistData?.trackCount} brani</p>
        </div>
      </button>
      <p className="text-[10px] px-3 pb-2 opacity-70 text-white">
        {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

function VoiceMessage({ msg, isMine }: { msg: any; isMine: boolean }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className={`rounded-2xl overflow-hidden ${isMine ? "bg-blue-600" : "bg-spotify-green"}`}>
      <button
        onClick={() => setPlaying(!playing)}
        className="flex items-center gap-3 p-3 text-white"
      >
        <div className="w-9 h-9 rounded-full bg-black/20 flex items-center justify-center">
          {playing ? <X className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </div>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-black/20 overflow-hidden">
            <div className="h-full w-1/3 rounded-full bg-white/50" />
          </div>
        </div>
        <span className="text-xs opacity-80">{msg.voiceDuration || "0:00"}</span>
      </button>
      <p className="text-[10px] px-3 pb-2 opacity-70 text-white">
        {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}
