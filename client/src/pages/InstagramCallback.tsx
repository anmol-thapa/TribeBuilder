import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

const InstagramCallback = () => {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const error = params.get("error");
    if (code) {
      console.log("Instagram OAuth code received (backend exchange not wired yet):", code);
    }
    if (error) {
      console.warn("Instagram OAuth error:", error, params.get("error_description"));
    }
  }, [location.search]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Instagram OAuth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>We received your redirect from Instagram.</p>
          <p>Backend token exchange is not yet wired in this app. Please add a server endpoint to exchange the <code>code</code> for access tokens and connect the account.</p>
          <p>Check the browser console for the received code while developing.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default InstagramCallback;
