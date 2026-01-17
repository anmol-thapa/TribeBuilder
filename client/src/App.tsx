import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { RealtimeProvider } from "./contexts/RealtimeContext";
import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import SocialDashboard from "./pages/SocialDashboard";
import InstagramCallback from "./pages/InstagramCallback";
import PersonaForm from "./pages/PersonaForm";
import MediaUpload from "./pages/MediaUpload";
import ImageEditor from "./pages/ImageEditor";
import VideoEditor from "./pages/VideoEditor";
import ContentGenerator from "./pages/ContentGenerator";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RealtimeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <div className="min-h-screen bg-background">
              <Navigation />
              <Routes>
                <Route path="/social" element={<SocialDashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/persona" element={<ProtectedRoute><PersonaForm /></ProtectedRoute>} />
          <Route path="/instagram/callback" element={<InstagramCallback />} />
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
