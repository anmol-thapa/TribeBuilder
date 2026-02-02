import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const OAuthComplete = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  const closePopup = () => {
    window.close();
  }

  const success = searchParams.get("success") === "1";
  const error = searchParams.get("error");
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "social";
  const platform = searchParams.get("platform") || state || "social";

  useEffect(() => {
    const completeAuth = async () => {
      if (!success || !code) {
        const type = success ? `${platform}-auth-success` : `${platform}-auth-error`;
        const payload = success
          ? { type, platform }
          : { type, platform, error: error || "Authentication failed" };

        if (window.opener) {
          window.opener.postMessage(payload, "*");
        }

        // If connection succeeded but no code (e.g. Reddit), try syncing analytics
        if (success) {
          try {
            let { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
              const refreshed = await supabase.auth.refreshSession();
              session = refreshed.data.session || null;
            }

            if (session?.access_token) {
              await supabase.functions.invoke("sync-social-analytics", {
                body: { platform },
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });
            }
          } catch {
            // ignore auto-sync errors here
          }
        }
        return;
      }

      setIsSubmitting(true);
      setFinalError(null);
      try {
        let { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          const refreshed = await supabase.auth.refreshSession();
          session = refreshed.data.session || null;
        }

        if (!session?.access_token) {
          // Fallback: try to read access token from localStorage (popup sometimes lacks session)
          const keys = Object.keys(localStorage).filter(
            (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
          );
          for (const key of keys) {
            try {
              const raw = localStorage.getItem(key);
              if (!raw) continue;
              const parsed = JSON.parse(raw);
              const token =
                parsed?.access_token ||
                parsed?.currentSession?.access_token ||
                parsed?.currentSession?.provider_token;
              if (token) {
                session = { access_token: token } as any;
                break;
              }
            } catch {
              // ignore
            }
          }
        }

        if (!session?.access_token) {
          throw new Error("Supabase session missing");
        }

        const { error: invokeError } = await supabase.functions.invoke("social-auth", {
          body: { platform, code, state },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (invokeError) {
          throw new Error(invokeError.message || "Failed to finalize connection");
        }

        // Auto-sync analytics after successful connection
        const { error: syncError } = await supabase.functions.invoke("sync-social-analytics", {
          body: { platform },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (syncError) {
          console.warn("Analytics sync failed after connect:", syncError);
        }

        if (window.opener) {
          window.opener.postMessage({ type: `${platform}-auth-success`, platform }, "*");
        }
      } catch (err: any) {
        const message = err?.message || "Authentication failed";
        setFinalError(message);
        toast({
          title: "Connection failed",
          description: message,
          variant: "destructive",
        });
        if (window.opener) {
          window.opener.postMessage({ type: `${platform}-auth-error`, platform, error: message }, "*");
        }
      } finally {
        setIsSubmitting(false);
      }
    };

    completeAuth();
  }, [success, error, platform, code, state, toast]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">
            {success ? "Connected ✅" : "Connection Failed ❌"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {success
              ? (isSubmitting
                ? `Finalizing ${platform} connection...`
                : `Your ${platform} account is now connected. You can close this tab.`)
              : finalError || error || `Authentication failed for ${platform}. Please try again.`}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={closePopup}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div >
  );
};

export default OAuthComplete;
