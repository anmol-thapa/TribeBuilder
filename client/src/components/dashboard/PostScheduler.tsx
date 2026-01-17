import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useScheduledPosts } from "@/hooks/useScheduledPosts";
import { usePostToX } from "@/hooks/usePostToX";
import { useRedditPost } from "@/hooks/useRedditPost";
import { useToast } from "@/hooks/use-toast";
import { useMediaUpload, PLATFORM_LIMITS } from "@/hooks/useMediaUpload";
import { useSocialData } from "@/hooks/useSocialData";
import {
  CalendarIcon, 
  Clock, 
  Image, 
  Send, 
  Instagram, 
  Twitter, 
  Facebook,
  Linkedin,
  Eye,
  Edit2,
  Trash2,
  Upload,
  X as CloseIcon
} from "lucide-react";
import { SiReddit } from "react-icons/si";
import { format } from "date-fns";

export const PostScheduler = () => {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [postContent, setPostContent] = useState("");
  const [postTitle, setPostTitle] = useState("");
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [scheduledTime, setScheduledTime] = useState("");
  const [contentType, setContentType] = useState<'text' | 'video'>('text');
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { posts, loading, schedulePost, cancelPost, deletePost } = useScheduledPosts();
  const { postToX, isPosting } = usePostToX();
  const { postToReddit, isPosting: isPostingReddit } = useRedditPost();
  const { connections } = useSocialData();
  const { toast } = useToast();
  const { uploadMultipleMedia, uploading, uploadProgress, getMaxFileSize } = useMediaUpload();

  // Platform capabilities
  const platformCapabilities = {
    instagram: { text: false, video: true }, // Instagram only supports reels/videos
    twitter: { text: true, video: true },
    facebook: { text: true, video: true },
    linkedin: { text: true, video: true },
    reddit: { text: true, video: false },
  };

  const allPlatforms = [
    { id: "instagram", name: "Instagram", icon: Instagram, color: "gradient-instagram" },
    { id: "twitter", name: "Twitter", icon: Twitter, color: "bg-social-twitter" },
    { id: "facebook", name: "Facebook", icon: Facebook, color: "bg-social-facebook" },
    { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "bg-social-linkedin" },
    { id: "reddit", name: "Reddit", icon: SiReddit, color: "bg-social-reddit" },
  ];

  // Filter platforms based on content type
  const platforms = allPlatforms.filter(platform => {
    const capabilities = platformCapabilities[platform.id as keyof typeof platformCapabilities];
    return capabilities[contentType];
  });

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (selectedPlatforms.length === 0) {
      toast({
        title: "Select platforms first",
        description: "Please select which platforms you want to post to before uploading media",
        variant: "destructive",
      });
      return;
    }

    const urls = await uploadMultipleMedia(files, selectedPlatforms);
    if (urls.length > 0) {
      setUploadedMediaUrls(prev => [...prev, ...urls]);
    }
  };

  const removeMedia = (url: string) => {
    setUploadedMediaUrls(prev => prev.filter(u => u !== url));
  };

  const getFileSizeInfo = () => {
    if (selectedPlatforms.length === 0) return null;
    const videoLimit = getMaxFileSize(selectedPlatforms, 'video');
    const imageLimit = getMaxFileSize(selectedPlatforms, 'image');
    return { videoLimit, imageLimit };
  };

  const handleSchedulePost = async () => {
    if (!postContent.trim()) {
      return;
    }

    if (selectedPlatforms.length === 0) {
      return;
    }

    if (!scheduledDate || !scheduledTime) {
      return;
    }

    try {
      // Combine date and time
      const [hours, minutes] = scheduledTime.split(':');
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      await schedulePost(postContent, selectedPlatforms, scheduledDateTime, uploadedMediaUrls);

      // Reset form
      setPostContent("");
      setPostTitle("");
      setSelectedPlatforms([]);
      setScheduledDate(undefined);
      setScheduledTime("");
      setUploadedMediaUrls([]);
    } catch (error) {
      // Error handled in hook
    }
  };

  const getPlatformIcon = (platformId: string) => {
    const platform = allPlatforms.find(p => p.id === platformId);
    return platform?.icon || Instagram;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Post Creation */}
      <div className="space-y-6">
        <Card className="glass border-border/20">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Edit2 className="h-5 w-5" />
              <span>Create New Post</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Content Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Content Type</Label>
              <div className="flex gap-2">
                <Button
                  variant={contentType === 'text' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setContentType('text');
                    // Remove Instagram and YouTube if selected (they don't support text)
                    setSelectedPlatforms(prev => prev.filter(p => p !== 'instagram'));
                  }}
                >
                  Text Post
                </Button>
                <Button
                  variant={contentType === 'video' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setContentType('video')}
                >
                  Video/Reel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {contentType === 'text' 
                  ? 'Text posts are supported on Twitter, Facebook, and LinkedIn' 
                  : 'Video content is supported on all platforms (Instagram only supports videos)'}
              </p>
            </div>

            {/* Platform Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Select Platforms</Label>
              <div className="grid grid-cols-2 gap-3">
                {platforms.map((platform) => {
                  const Icon = platform.icon;
                  const isSelected = selectedPlatforms.includes(platform.id);
                  // Keep selected buttons visibly filled without relying on platform color classes
                  const selectedClass = isSelected
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border-border/50';

                  return (
                    <Button
                      key={platform.id}
                      variant={isSelected ? "default" : "outline"}
                      className={`justify-start ${selectedClass}`}
                      onClick={() => togglePlatform(platform.id)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {platform.name}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Reddit Title (conditional) */}
            {selectedPlatforms.includes('reddit') && (
              <div className="space-y-2">
                <Label htmlFor="title">Post Title (Required for Reddit)</Label>
                <Input
                  id="title"
                  placeholder="Enter post title..."
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  maxLength={300}
                  className="bg-muted/20 border-border/50"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{postTitle.length}/300 characters</span>
                </div>
              </div>
            )}

            {/* Post Content */}
            <div className="space-y-2">
              <Label htmlFor="content">Post Content</Label>
              <Textarea
                id="content"
                placeholder="What's happening? Share your thoughts..."
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="min-h-[120px] bg-muted/20 border-border/50"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{postContent.length}/280 characters</span>
                {postContent.length > 280 && (
                  <span className="text-destructive">Character limit exceeded</span>
                )}
              </div>
            </div>

            {/* Media Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Media</Label>
                {getFileSizeInfo() && (
                  <p className="text-xs text-muted-foreground">
                    Max: {getFileSizeInfo()?.imageLimit}MB images, {getFileSizeInfo()?.videoLimit}MB videos
                  </p>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={selectedPlatforms.length === 0 || uploading}
              />
              
              <div 
                className="border-2 border-dashed border-border/50 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <div className="space-y-2">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-primary animate-pulse" />
                    <p className="text-sm text-muted-foreground">
                      Uploading... {uploadProgress}%
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to upload images/videos
                    </p>
                    {selectedPlatforms.length === 0 && (
                      <p className="text-xs text-destructive mt-1">
                        Select platforms first
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Preview uploaded media */}
              {uploadedMediaUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {uploadedMediaUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      {url.includes('.mp4') || url.includes('.mov') || url.includes('.webm') ? (
                        <video 
                          src={url} 
                          className="w-full h-24 object-cover rounded border border-border/50"
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt={`Upload ${index + 1}`}
                          className="w-full h-24 object-cover rounded border border-border/50"
                        />
                      )}
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMedia(url);
                        }}
                      >
                        <CloseIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Scheduling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Schedule Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-muted/20"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Schedule Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="bg-muted/20"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <Button
                onClick={handleSchedulePost}
                className="flex-1 gradient-primary hover-glow text-white"
                disabled={
                  !postContent.trim() || 
                  selectedPlatforms.length === 0 || 
                  !scheduledDate || 
                  !scheduledTime ||
                  (selectedPlatforms.includes('reddit') && !postTitle.trim())
                }
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule Post
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 border-primary/20 hover:bg-primary/10"
                disabled={
                  !postContent.trim() || 
                  selectedPlatforms.length === 0 || 
                  isPosting || 
                  isPostingReddit ||
                  (selectedPlatforms.includes('reddit') && !postTitle.trim())
                }
                onClick={async () => {
                  try {
                    // Reddit requires title validation
                    if (selectedPlatforms.includes('reddit') && !postTitle.trim()) {
                      toast({
                        title: "Title Required",
                        description: "Reddit posts require a title",
                        variant: "destructive",
                      });
                      return;
                    }

                    // Post to each selected platform
                    if (selectedPlatforms.includes('twitter')) {
                      await postToX(postContent, uploadedMediaUrls);
                    }

                    if (selectedPlatforms.includes('reddit')) {
                      const redditConnection = connections.find(c => c.platform === 'reddit');
                      if (redditConnection) {
                        await postToReddit(postContent, postTitle, redditConnection.id, uploadedMediaUrls);
                      }
                    }
                    
                    // Other platforms can be added here in the future
                    if (selectedPlatforms.some(p => ['facebook', 'linkedin', 'instagram'].includes(p))) {
                      // Show coming soon message for other platforms
                      const otherPlatforms = selectedPlatforms.filter(p => !['twitter', 'reddit'].includes(p));
                      if (otherPlatforms.length > 0) {
                        toast({
                          title: "Coming Soon",
                          description: `Posting to ${otherPlatforms.join(', ')} will be available soon!`,
                        });
                      }
                    }
                    
                    // Reset form on success
                    setPostContent("");
                    setPostTitle("");
                    setSelectedPlatforms([]);
                    setUploadedMediaUrls([]);
                  } catch (error) {
                    // Error handled in hook
                  }
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                {isPosting || isPostingReddit ? 'Posting...' : 'Post Now'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Posts */}
      <div className="space-y-6">
        <Card className="glass border-border/20">
          <CardHeader>
            <CardTitle className="text-lg">Scheduled Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 custom-scroll max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading scheduled posts...
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No scheduled posts yet. Create your first post above!
              </div>
            ) : (
              posts.map((post) => (
                <div
                  key={post.id}
                  className="border border-border/20 rounded-lg p-4 space-y-3 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex space-x-2">
                      {post.platforms.map((platformId) => {
                        const Icon = getPlatformIcon(platformId);
                        return (
                          <div
                            key={platformId}
                            className="p-1 rounded bg-muted/20"
                          >
                            <Icon className="h-3 w-3" />
                          </div>
                        );
                      })}
                    </div>
                    <Badge 
                      variant={post.status === 'published' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {post.status}
                    </Badge>
                  </div>

                  <p className="text-sm text-foreground line-clamp-3">
                    {post.content}
                  </p>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(post.scheduled_for), "MMM d, HH:mm")}</span>
                    </div>
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="flex items-center space-x-1">
                        <Image className="h-3 w-3" />
                        <span>{post.media_urls.length}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Button size="sm" variant="ghost" className="h-7 px-2">
                      <Eye className="h-3 w-3" />
                    </Button>
                    {post.status === 'scheduled' && new Date(post.scheduled_for) > new Date() && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 px-2 text-destructive hover:bg-destructive/10"
                        onClick={() => cancelPost(post.id)}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 px-2 text-destructive hover:bg-destructive/10"
                      onClick={() => deletePost(post.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
