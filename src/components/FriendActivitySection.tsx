import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/contexts/PlayerContext";
import SafeImg from "@/components/SafeImg";
import { Headphones, SmilePlus, RadioTower, HeadphonesIcon, Radio as RadioIcon } from "lucide-react";
import { toast } from "sonner";

const EMOJIS = ["❤️", "🔥", "😍", "🎵", "💃", "🕺", "👏", "🤩"];

export default function FriendActivitySection() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { playTrack, setListenTogetherSession, setFollowingTogether } = usePlayer();

  const { data: friendActivity = [] } = trpc.social.friendActivity.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 5000,
  });

  const createTogetherMutation = trpc.listenTogether.create.useMutation({
    onSuccess: (data: any) => {
      setListenTogetherSession(data);
      toast.success("Sessione 'Ascolta Insieme' creata! Condividi il codice: " + data?.code);
    },
    onError: (err) => toast.error(err.message),
  });

  const [reactionPicker, setReactionPicker] = useState<{ userId: number; trackId: string } | null>(null);
  const addReactionMutation = trpc.social.addReaction.useMutation({
    onSuccess: () => toast.success("Reazione inviata!"),
    onError: (err) => toast.error(err.message),
  });

  if (!user || friendActivity.length === 0) return null;

  return (
    <section className="fade-in-up">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-spotify-green/10 flex items-center justify-center">
          <Headphones className="w-4 h-4 spotify-green" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Cosa ascoltano gli amici</h2>
          <p className="text-xs text-muted-foreground">Attività in tempo reale</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {friendActivity.map((friend: any) => (
          <div key={friend.userId} className="bg-surface-1 rounded-xl p-3 flex items-center gap-3 border border-border/20 hover:border-spotify-green/30 transition-all">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-surface-2">
              <SafeImg src={friend.trackThumbnail} alt={friend.trackTitle} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-spotify-green border-2 border-surface-1 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{friend.name}</span> ascolta
              </p>
              <p className="text-sm font-medium truncate">{friend.trackTitle}</p>
              <p className="text-xs text-muted-foreground truncate">{friend.trackArtist}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <div className="relative">
                <button
                  onClick={() => setReactionPicker(reactionPicker?.userId === friend.userId ? null : { userId: friend.userId, trackId: friend.trackId })}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                  title="Reagisci"
                >
                  <SmilePlus className="w-4 h-4" />
                </button>
                {reactionPicker && reactionPicker.userId === friend.userId && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setReactionPicker(null)} />
                    <div className="absolute bottom-full right-0 mb-2 bg-card border border-border rounded-xl shadow-2xl p-2 z-50 flex gap-1">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => { addReactionMutation.mutate({ toUserId: friend.userId, trackId: friend.trackId, emoji }); setReactionPicker(null); }}
                          className="w-8 h-8 flex items-center justify-center hover:bg-surface-1 rounded-lg text-lg transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  createTogetherMutation.mutate({
                    trackId: friend.trackId,
                    trackTitle: friend.trackTitle,
                    trackArtist: friend.trackArtist,
                    trackThumbnail: friend.trackThumbnail,
                  });
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-spotify-green hover:bg-spotify-green/10 transition-colors"
                title="Ascolta insieme"
              >
                <RadioTower className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  playTrack({ id: friend.trackId, title: friend.trackTitle, artist: friend.trackArtist, thumbnail: friend.trackThumbnail, type: "track" });
                }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-spotify-green hover:bg-spotify-green/10 transition-colors"
                title="Riproduci"
              >
                <HeadphonesIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/jam")}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                title="Avvia JAM"
              >
                <RadioIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
