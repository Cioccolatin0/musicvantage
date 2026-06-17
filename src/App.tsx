import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AdminInvites from "@/pages/AdminInvites";
import AdminPage from "@/pages/Admin";
import SharedPlaylists from "@/pages/SharedPlaylists";
import ShareView from "@/pages/ShareView";
import Jam from "@/pages/Jam";
import PlaylistView from "@/pages/PlaylistView";
import Chat from "@/pages/Chat";
import Profile from "@/pages/Profile";
import Friends from "@/pages/Friends";
import NotificationsPage from "@/pages/Notifications";
import SettingsPage from "@/pages/Settings";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import AnimatedBackground from "./components/AnimatedBackground";
import { PlayerProvider } from "./contexts/PlayerContext";
import AutoplayManager from "./components/AutoplayManager";
import PWAInstallPrompt from "./components/PWAInstallPrompt";
import MediaSessionManager from "./components/MediaSessionManager";
import PushNotificationSetup from "./components/PushNotificationSetup";
import Home from "./pages/Home";
import SearchResults from "./pages/SearchResults";
import ArtistPage from "./pages/ArtistPage";
import ArtistReleasesPage from "./pages/ArtistReleasesPage";
import AlbumPage from "./pages/AlbumPage";
import Library from "./pages/Library";
import VantagePage from "./pages/VantagePage";
import Layout from "./components/Layout";
import { useFriendActivityWs } from "./hooks/useFriendActivityWs";

function FriendActivitySocket() {
  useFriendActivityWs();
  return null;
}

function Router() {
  return (
    <Layout>
      <AnimatedBackground />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/search" component={SearchResults} />
        <Route path="/artist/:id/releases" component={ArtistReleasesPage} />
        <Route path="/artist/:id" component={ArtistPage} />
        <Route path="/album/:id" component={AlbumPage} />
        <Route path="/library" component={Library} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/admin/invites" component={AdminInvites} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/shared" component={SharedPlaylists} />
        <Route path="/share/:code" component={ShareView} />
        <Route path="/jam" component={Jam} />
        <Route path="/playlist/:id" component={PlaylistView} />
        <Route path="/chat" component={Chat} />
        <Route path="/chat/:conversationId" component={Chat} />
        <Route path="/vantage" component={VantagePage} />
        <Route path="/profile" component={Profile} />
        <Route path="/profile/:userId" component={Profile} />
        <Route path="/friends" component={Friends} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <PlayerProvider>
        <FriendActivitySocket />
        <AutoplayManager />
        <MediaSessionManager />
        <PWAInstallPrompt />
        <PushNotificationSetup />
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </PlayerProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
