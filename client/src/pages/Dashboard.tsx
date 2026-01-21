import { useEffect, useState } from 'react';
import { useArtistStore } from '@/stores/artistStore';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Music, Image, Video, FileText, Loader2 } from 'lucide-react';
import heroImage from '@/assets/musician-hero.jpg';

const Dashboard = () => {
  const { artistData, mediaFiles, uploadedFiles, updateArtistData, setUploadedFiles } = useArtistStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch artist profile and uploaded files on mount
    const loadData = async () => {
      try {
        const userData = await apiClient.getCurrentUser();

        // Load artist data into Zustand if it exists
        if (userData.artist) {
          updateArtistData({
            artistName: userData.artist.artist_name || '',
            genre: userData.artist.genre || '',
            bio: userData.artist.bio || '',
          });
        }

        // Fetch uploaded files
        try {
          const filesData = await apiClient.getUploadedFiles();
          if (filesData.files) {
            setUploadedFiles(filesData.files);
          }
        } catch (error) {
          console.log('No uploaded files found or not logged in');
        }
      } catch (error) {
        console.log('No artist profile found or not logged in');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [updateArtistData, setUploadedFiles]);

  const getMediaTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return Image;
      case 'video': return Video;
      case 'audio': return Music;
      default: return FileText;
    }
  };

  const mediaStats = {
    image: mediaFiles.filter(f => f.type === 'image').length,
    video: mediaFiles.filter(f => f.type === 'video').length,
    audio: mediaFiles.filter(f => f.type === 'audio').length,
    uploads: uploadedFiles.length,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-64 bg-gradient-hero overflow-hidden">
        <img
          src={heroImage}
          alt="Musician artist workspace with instruments and studio equipment"
          className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30"
        />
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center text-primary-foreground">
            <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">
              Welcome to TribeBuilder
            </h1>
            <p className="text-xl opacity-90 max-w-2xl mx-auto px-4">
              Your musical journey starts here. Manage your artist profile and showcase your music.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Artist Profile Card */}
          <Card className="bg-gradient-card shadow-card border-border/50 hover:shadow-creative transition-all duration-300">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <div className="bg-primary/10 p-2 rounded-lg mr-3">
                <User className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Artist Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {artistData.artistName ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{artistData.artistName}</p>
                  </div>
                  {artistData.genre && (
                    <div>
                      <p className="text-sm text-muted-foreground">Genre</p>
                      <Badge variant="secondary" className="mt-1">
                        {artistData.genre}
                      </Badge>
                    </div>
                  )}
                  {artistData.bio && (
                    <div>
                      <p className="text-sm text-muted-foreground">Bio</p>
                      <p className="text-sm leading-relaxed line-clamp-3">
                        {artistData.bio}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Complete your persona form to see your profile here.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Media Statistics */}
          <Card className="bg-gradient-card shadow-card border-border/50 hover:shadow-creative transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg">Media Library</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(mediaStats).map(([type, count]) => {
                  const Icon = getMediaTypeIcon(type);
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="capitalize">{type}</span>
                      </div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between font-medium">
                    <span>Total Files</span>
                    <Badge variant="default">{mediaFiles.length}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-gradient-card shadow-card border-border/50 hover:shadow-creative transition-all duration-300">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Get started with these essential steps:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span>Set up your music profile</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span>Upload your music tracks</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <span>Build your music library</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Uploaded Files from Backend */}
        {uploadedFiles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-6">Uploaded Files</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploadedFiles.map((file) => (
                <Card key={file.id} className="bg-gradient-card shadow-card border-border/50 hover:shadow-creative transition-all duration-300">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <p className="font-medium truncate">{file.source_url}</p>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="capitalize">{file.source_type}</span>
                        <Badge variant="outline">{Math.round(file.transcript_length / 1000)}KB</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Media Files */}
        {mediaFiles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-6">Recent Uploads</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mediaFiles.slice(-4).map((file) => {
                const Icon = getMediaTypeIcon(file.type);
                return (
                  <Card key={file.id} className="bg-gradient-card shadow-card border-border/50 hover:shadow-creative transition-all duration-300">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {file.type}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;