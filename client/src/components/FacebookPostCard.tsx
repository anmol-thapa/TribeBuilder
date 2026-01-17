import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useFacebookPost } from '@/hooks/useFacebookPost';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { Facebook, ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';

export function FacebookPostCard() {
  const [message, setMessage] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const { postToFacebook, isPosting } = useFacebookPost();
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

    const url = await uploadMedia(file, ['facebook']);
    if (url) {
      setMediaUrls([...mediaUrls, url]);
    }
  };

  const removeMedia = (url: string) => {
    setMediaUrls(mediaUrls.filter(u => u !== url));
  };

  const handlePost = async () => {
    if (!message.trim()) return;
    
    try {
      await postToFacebook(message, undefined, mediaUrls.length > 0 ? mediaUrls : undefined);
      setMessage('');
      setMediaUrls([]);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Facebook className="h-5 w-5" />
          Post to Facebook
        </CardTitle>
        <CardDescription>
          Share your content on Facebook
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="What's on your mind?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
        />

        {/* Media Upload Section */}
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
            id="fb-media-upload"
            disabled={uploading || mediaUrls.length >= 1}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('fb-media-upload')?.click()}
            disabled={uploading || mediaUrls.length >= 1}
            className="w-full"
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            {uploading ? `Uploading... ${uploadProgress}%` : 'Add Media'}
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

        <div className="flex items-center justify-end">
          <Button 
            onClick={handlePost} 
            disabled={isPosting || !message.trim() || uploading}
            className="bg-social-facebook hover:bg-social-facebook/90 text-white"
          >
            {isPosting ? 'Posting...' : 'Post to Facebook'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
