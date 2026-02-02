import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { RealtimeProvider } from "./contexts/RealtimeContext";
import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import SocialDashboard from "./pages/SocialDashboard";
import OAuthComplete from "./pages/OAuthComplete";
import PersonaForm from "./pages/PersonaForm";
import MediaUpload from "./pages/MediaUpload";
import ImageEditor from "./pages/ImageEditor";
import VideoEditor from "./pages/VideoEditor";
import ContentGenerator from "./pages/ContentGenerator";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const XOAuthRedirector = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Ensure X OAuth callbacks land on the social dashboard
  if (location.search.includes("x_connected=") || location.search.includes("x_auth=")) {
    if (location.pathname !== "/social") {
      navigate(`/social${location.search}`, { replace: true });
    }
  }

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RealtimeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <XOAuthRedirector />
            <div className="min-h-screen bg-background">
              <Navigation />
              <Routes>
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/social" element={<ProtectedRoute><SocialDashboard /></ProtectedRoute>} />
                <Route path="/login" element={<Login />} />
                <Route path="/oauth/complete" element={<OAuthComplete />} />
                <Route path="/persona" element={<ProtectedRoute><PersonaForm /></ProtectedRoute>} />
                <Route path="/media" element={<ProtectedRoute><MediaUpload /></ProtectedRoute>} />
                <Route path="/content-generator" element={<ProtectedRoute><ContentGenerator /></ProtectedRoute>} />
                <Route path="/image-editor" element={<ProtectedRoute><ImageEditor /></ProtectedRoute>} />
                <Route path="/video-editor" element={<ProtectedRoute><VideoEditor /></ProtectedRoute>} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </BrowserRouter>
        </TooltipProvider>
      </RealtimeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
