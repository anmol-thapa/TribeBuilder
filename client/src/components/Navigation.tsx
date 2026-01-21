import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Music, User, Upload, Sparkles, Image, Video, LogOut, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import RealtimeNotifications from './RealtimeNotifications';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const navItems = [{
    path: '/',
    label: 'Dashboard',
    icon: Sparkles
  }, {
    path: '/persona',
    label: 'Persona',
    icon: User
  }, {
    path: '/content-generator',
    label: 'AI Content',
    icon: Sparkles
  }, {
    path: '/media',
    label: 'Media',
    icon: Upload
  }, {
    path: '/social',
    label: 'Social',
    icon: Sparkles
  }, {
    path: '/image-editor',
    label: 'Image Editor',
    icon: Image
  }, {
    path: '/video-editor',
    label: 'Video Editor',
    icon: Video
  }];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Don't show navigation on login or oauth completion pages
  if (location.pathname === '/login' || location.pathname.startsWith('/oauth/complete')) {
    return null;
  }

  return (
    <nav className="bg-gradient-card shadow-card border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-primary p-2 rounded-lg shadow-glow">
              <Music className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              TribeBuilder
            </h1>
          </div>

          <div className="flex items-center space-x-1">
            {navItems.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition-all duration-200 text-sm",
                  "hover:bg-primary/10 hover:shadow-sm",
                  location.pathname === path
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{label}</span>
              </Link>
            ))}

            {isAuthenticated && (
              <div className="ml-2">
                <RealtimeNotifications />
              </div>
            )}

            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="ml-2 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
                className="ml-2"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
