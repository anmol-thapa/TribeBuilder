import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useXPost } from '@/hooks/useXPost';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { X as XIcon, ImageIcon, X } from 'lucide-react';
import { XConnectButton } from './XConnectButton';
import { toast } from 'sonner';

export function XPostCard() {
  const [tweetText, setTweetText] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const { postTweet, isPosting } = useXPost();
  const { uploadMedia, uploading, uploadProgress } = useMediaUpload();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Only images and videos are supported');
      return;
    }

    const url = await uploadMedia(file, ['x']);
    if (url) {
      setMediaUrls([...mediaUrls, url]);
    }
  };

  const removeMedia = (url: string) => {
    setMediaUrls(mediaUrls.filter(u => u !== url));
  };

  const handlePost = async () => {
    if (!tweetText.trim()) return;
    
    try {
      await postTweet(tweetText, mediaUrls.length > 0 ? mediaUrls : undefined);
      setTweetText('');
      setMediaUrls([]);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XIcon className="h-5 w-5" />
          Post to X
        </CardTitle>
        <CardDescription>
          Post a tweet to X
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="What's happening?"
          value={tweetText}
          onChange={(e) => setTweetText(e.target.value)}
          maxLength={280}
          rows={4}
        />
        
        {/* Media Upload Section */}
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="x-media-upload"
            disabled={uploading || mediaUrls.length >= 4}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('x-media-upload')?.click()}
            disabled={uploading || mediaUrls.length >= 4}
            className="w-full"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            {uploading ? `Uploading... ${uploadProgress}%` : 'Add Media (Max 4)'}
          </Button>

          {/* Media Preview */}
          {mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {mediaUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-border"
                  />
                  <button
                    onClick={() => removeMedia(url)}
                    className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {tweetText.length}/280
          </span>
          <Button 
            onClick={handlePost} 
            disabled={isPosting || !tweetText.trim() || uploading}
          >
            {isPosting ? 'Posting...' : 'Post Tweet'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
