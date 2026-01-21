import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const OAuthComplete = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const closePopup = () => {
    window.close();
  }

  const success = searchParams.get("success") === "1";
  const error = searchParams.get("error");
  const platform = searchParams.get("platform") || "social";

  useEffect(() => {
    const type = success ? `${platform}-auth-success` : `${platform}-auth-error`;
    const payload = success
      ? { type, platform }
      : { type, platform, error: error || "Authentication failed" };

    if (window.opener) {
      window.opener.postMessage(payload, "*");
    }

    // Navigate back to social page after feedback
    // setTimeout(() => {
    //   navigate("/social", { replace: true });
    // }, 300);
  }, [success, error, platform]);

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
              ? `Your ${platform} account is now connected. You can close this tab.`
              : error || `Authentication failed for ${platform}. Please try again.`}
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
