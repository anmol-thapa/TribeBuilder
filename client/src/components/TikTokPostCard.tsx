import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTikTokPost } from "@/hooks/useTikTokPost";
import { Video } from "lucide-react";

interface TikTokPostCardProps {
  connectionId?: string;
}

export const TikTokPostCard = ({ connectionId }: TikTokPostCardProps) => {
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const { postToTikTok, isPosting } = useTikTokPost();

  const handlePost = async () => {
    if (!videoUrl) {
      return;
    }

    const result = await postToTikTok(videoUrl, caption, connectionId);
    
    if (result.success) {
      setVideoUrl("");
      setCaption("");
    }
  };

  return (
    <Card className="glass border-border/20">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Video className="h-5 w-5" />
          <span>Post to TikTok</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tiktok-video-url">Video URL</Label>
          <Input
            id="tiktok-video-url"
            placeholder="https://example.com/video.mp4"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            disabled={isPosting}
          />
          <p className="text-xs text-muted-foreground">
            Enter a direct link to your video file (MP4)
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="tiktok-caption">Caption (optional)</Label>
          <Textarea
            id="tiktok-caption"
            placeholder="Write your caption..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            disabled={isPosting}
            rows={3}
            maxLength={2200}
          />
          <div className="text-xs text-muted-foreground text-right">
            {caption.length}/2200
          </div>
        </div>

        <Button
          onClick={handlePost}
          disabled={isPosting || !videoUrl}
          className="w-full"
        >
          {isPosting ? "Posting..." : "Post to TikTok"}
        </Button>
      </CardContent>
    </Card>
  );
};
