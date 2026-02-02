import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiClient, GeneratedContent } from '@/lib/api';
import { useRealtime } from '@/contexts/RealtimeContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Copy, Check, X as XIcon, Youtube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSocialData } from '@/hooks/useSocialData';
import { useRedditPost } from '@/hooks/useRedditPost';
import { useXPost } from '@/hooks/useXPost';

const RedditIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.25-1.25-1.25zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
  </svg>
);

const formSchema = z.object({
  content_type: z.enum(['announcement', 'release', 'news', 'social_post', 'story']),
  context: z.string().min(5, 'Context must be at least 5 characters').max(500),
  max_length: z.number().min(100).max(280).optional(),
  variations: z.number().min(1).max(5).optional(),
  provider: z.enum(['groq', 'openai', 'huggingface', 'auto']).optional(),
});

type FormData = z.infer<typeof formSchema>;

type GeneratedContentWithParts = GeneratedContent & {
  title?: string;
  body?: string;
};

const MAX_CONTEXT_LENGTH = 500;
const clampNumber = (value: number | undefined, min: number, max: number) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value!, min), max);
};

const enforceSentenceFriendlyLimit = (text: string, charLimit: number) => {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= charLimit) return trimmed;

  const forwardWindow = 200; // allow finishing the sentence close after the limit
  const searchWindow = trimmed.slice(charLimit, charLimit + forwardWindow);
  const forwardMatch = searchWindow.match(/[.!?]/);

  if (forwardMatch && typeof forwardMatch.index === 'number') {
    const cutIndex = charLimit + forwardMatch.index + 1; // include punctuation
    return trimmed.slice(0, cutIndex).trim();
  }

  const backwardSlice = trimmed.slice(0, charLimit);
  const backwardMatch = backwardSlice.match(/.*[.!?]/);
  if (backwardMatch && backwardMatch[0].length > 0) {
    return backwardMatch[0].trim();
  }

  // Fallback: hard trim at char limit
  return trimmed.slice(0, charLimit).trim();
};

const stripWrappingQuotes = (value: string) => value.replace(/^[\"“”]+|[\"“”]+$/g, '').trim();

const splitTitleBody = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return { title: 'New post from TribeBuilder', body: '' };
  }
  const match = trimmed.match(/TITLE:\s*([\s\S]*?)\s*BODY:\s*([\s\S]*)/i);
  if (match) {
    const title = stripWrappingQuotes(match[1].trim()).slice(0, 300);
    const body = stripWrappingQuotes(match[2].trim());
    return {
      title: title || 'New post from TribeBuilder',
      body,
    };
  }
  const firstLine = trimmed.split('\n').find((line) => line.trim().length > 0) || trimmed;
  const title = stripWrappingQuotes(firstLine.replace(/\s+/g, ' ').trim()).slice(0, 300);
  const body = stripWrappingQuotes(
    trimmed.startsWith(firstLine) ? trimmed.slice(firstLine.length).trim() : trimmed
  );
  return {
    title: title || 'New post from TribeBuilder',
    body,
  };
};

const ContentGenerator = () => {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentWithParts[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { subscribeToChannel, unsubscribeFromChannel, isConnected } = useRealtime();
  const { connections } = useSocialData();
  const { postToReddit: postToRedditEdge, isPosting: isPostingReddit } = useRedditPost();
  const { postTweet, isPosting: isPostingX } = useXPost();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content_type: 'social_post',
      context: '',
      max_length: 150,
      variations: 3,
      provider: 'auto',
    },
  });

  useEffect(() => {
    const channel = subscribeToChannel('content-generator-updates', (payload) => {
      const { eventType, new: newRecord } = payload;
      if (eventType === 'INSERT' && newRecord.table === 'generated_content') {
        console.log('New content generated:', newRecord);
      }
    });

    return () => {
      unsubscribeFromChannel(channel);
    };
  }, [subscribeToChannel, unsubscribeFromChannel]);

  const onSubmit = async (values: FormData) => {
    setIsGenerating(true);
    setGeneratedContent([]);

    try {
      const trimmedContext = values.context.trim().slice(0, MAX_CONTEXT_LENGTH);
      const safeCharLimit = clampNumber(values.max_length, 100, 280);
      const safeVariations = clampNumber(values.variations, 1, 5);

      const response = await apiClient.generateContent({
        content_type: values.content_type,
        context: trimmedContext,
        max_length: safeCharLimit,
        variations: safeVariations,
        provider: values.provider,
      });

      setGeneratedContent(
        response.generated_content.map((item) => ({
          ...item,
          content: enforceSentenceFriendlyLimit(item.content, safeCharLimit),
          ...splitTitleBody(item.content),
        }))
      );

      toast.success('Content generated successfully!', {
        description: `Generated ${response.generation_metadata.variations_generated} variations`,
      });
    } catch (error: any) {
      toast.error('Content generation failed', {
        description: error.message || 'Please try again. Make sure you have an active persona.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const postToX = async (content: string) => {
    const xConnection = connections.find((c) => c.platform === 'twitter' && c.is_active);
    if (!xConnection) {
      toast.error('X not connected', {
        description: 'Connect your X account before posting.',
      });
      return;
    }

    const loadingId = toast.loading('Posting to X...');
    const result = await postTweet(content);
    const tweetUrl = result?.tweetUrl || result?.data?.tweetUrl;
    if (!tweetUrl) {
      toast.error('X post failed', {
        id: loadingId,
        description: 'Please try again or reconnect X.',
      });
      return;
    }

    toast.success('Posted to X', {
      id: loadingId,
      description: (
        <a
          href={tweetUrl}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          View post
        </a>
      ),
    });
  };

  const postToReddit = async (content: string, title?: string) => {
    const redditConnection = connections.find((c) => c.platform === 'reddit' && c.is_active);
    if (!redditConnection) {
      toast.error('Reddit not connected', {
        description: 'Connect your Reddit account before posting.',
      });
      return;
    }

    const fallbackTitle = title || splitTitleBody(content).title;
    const safeTitle = fallbackTitle.slice(0, 300);

    const loadingId = toast.loading('Posting to Reddit...');
    const result = await postToRedditEdge(content, safeTitle, redditConnection.id);
    if (!result?.postUrl) {
      toast.error('Reddit post failed', {
        id: loadingId,
        description: 'Please try again or reconnect Reddit.',
      });
      return;
    }

    toast.success('Posted to Reddit', {
      id: loadingId,
      description: (
        <a
          href={result.postUrl}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          View post
        </a>
      ),
    });
  };

  const openYouTubeUpload = async (content: string, id?: string) => {
    const loadingId = toast.loading('Opening YouTube upload...');
    try {
      await navigator.clipboard.writeText(content);
      if (id) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      toast.success('Copied to clipboard', {
        id: loadingId,
        description: 'Text ready to paste into your YouTube post/description.',
      });
    } catch (err) {
      toast.error('Could not copy to clipboard', {
        id: loadingId,
        description: 'Please copy manually before uploading.',
      });
    }

    try {
      const response = await supabase.functions.invoke('youtube-upload', {
        body: { content },
      });
      const studioUrl = response.data?.studioUrl || 'https://studio.youtube.com';
      const opened = window.open(studioUrl, '_blank');
      if (!opened) {
        window.open('https://studio.youtube.com', '_blank');
      }
    } catch (error: any) {
      toast.error('YouTube upload unavailable', {
        id: loadingId,
        description: error?.message || 'Please try again after connecting YouTube.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="bg-gradient-primary p-3 rounded-full w-16 h-16 mx-auto mb-4 shadow-glow">
            <Sparkles className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold mb-2">AI Content Generator</h1>
          <p className="text-muted-foreground">
            Generate personalized content using AI based on your artist persona
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-card shadow-creative border-border/50 h-fit">
            <CardHeader>
              <CardTitle>Content Parameters</CardTitle>
              <CardDescription>
                Configure the type and context for AI-generated content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="content_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select content type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="social_post">Social Post</SelectItem>
                            <SelectItem value="announcement">Announcement</SelectItem>
                            <SelectItem value="release">Release</SelectItem>
                            <SelectItem value="news">News</SelectItem>
                            <SelectItem value="story">Story</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="context"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Context</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe what you want to post about... (e.g., 'new single dropping Friday', 'upcoming tour dates')"
                            className="resize-none h-24"
                            maxLength={MAX_CONTEXT_LENGTH}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Provide context for the AI to generate relevant content (max {MAX_CONTEXT_LENGTH} characters)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AI Provider</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select AI provider" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="auto">Auto (Recommended)</SelectItem>
                            <SelectItem value="groq">Groq (Fast)</SelectItem>
                            <SelectItem value="openai">OpenAI (Premium)</SelectItem>
                            <SelectItem value="huggingface">HuggingFace</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="variations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Variations</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={5}
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="max_length"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Length</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={100}
                              max={280}
                              {...field}
                              onBlur={(e) => {
                                const nextValue = clampNumber(parseInt(e.target.value), 100, 280);
                                field.onChange(nextValue);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-primary shadow-creative hover:shadow-glow transition-all duration-300"
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Content
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Generated Content</h2>

            {generatedContent.length === 0 && !isGenerating && (
              <Card className="bg-gradient-card shadow-card border-border/50">
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No content generated yet. Fill out the form and click "Generate Content" to get started.
                  </p>
                </CardContent>
              </Card>
            )}

            {isGenerating && (
              <Card className="bg-gradient-card shadow-card border-border/50">
                <CardContent className="py-12 text-center">
                  <Sparkles className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
                  <p className="text-muted-foreground">Generating content with AI...</p>
                </CardContent>
              </Card>
            )}

            {generatedContent.map((content, index) => (
              <Card
                key={content.id || index}
                className="bg-gradient-card shadow-creative border-border/50 hover:shadow-glow transition-all duration-300"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Variation {content.variation_id}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        Score: {(content.quality_score * 100).toFixed(0)}%
                      </Badge>
                      <Badge variant="secondary" className="capitalize">
                        {content.model_used}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Title</p>
                        <p className="text-sm font-semibold">{content.title || splitTitleBody(content.content).title}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Body</p>
                        <p className="text-sm leading-relaxed">{content.body || splitTitleBody(content.content).body}</p>
                      </div>
                    </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(content.body || content.content, content.id)}
                      className="flex-1 min-w-[120px]"
                    >
                      {copiedId === content.id ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => postToX(content.body || content.content)}
                      className="flex-1 min-w-[120px] bg-black text-white hover:bg-black/90"
                    >
                      <XIcon className="h-4 w-4 mr-2" />
                      Post to X
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => postToReddit(content.body || content.content, content.title)}
                      className="flex-1 min-w-[120px] bg-[#FF4500] text-white hover:bg-[#FF4500]/90"
                    >
                      <RedditIcon className="h-4 w-4 mr-2" />
                      Post to Reddit
                    </Button>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openYouTubeUpload(content.body || content.content, content.id)}
                      className="flex-1 min-w-[150px] bg-[#FF0000] text-white hover:bg-[#e60000]"
                    >
                      <Youtube className="h-4 w-4 mr-2" />
                      YouTube Upload
                    </Button>
                  </div>

                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentGenerator;
