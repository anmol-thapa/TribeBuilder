import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useXPost } from '@/hooks/useXPost';
import { X as XIcon, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function XTestPanel() {
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const { getXUser, postTweet } = useXPost();

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      console.log("Testing X API connection...");
      const userData = await getXUser();
      console.log("X User data received:", userData);
      
      setTestResult({
        success: true,
        message: "Connection successful!",
        data: userData,
      });
    } catch (error: any) {
      console.error("X API test failed:", error);
      setTestResult({
        success: false,
        message: error.message || "Connection failed",
        error: error,
      });
    } finally {
      setTesting(false);
    }
  };

  const testTweet = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const testText = `Test tweet from TribeBuilder at ${new Date().toLocaleTimeString()}`;
      console.log("Posting test tweet:", testText);
      
      const result = await postTweet(testText);
      console.log("Tweet posted successfully:", result);
      
      setTestResult({
        success: true,
        message: "Test tweet posted successfully!",
        data: result,
      });
    } catch (error: any) {
      console.error("Tweet posting failed:", error);
      setTestResult({
        success: false,
        message: error.message || "Failed to post tweet",
        error: error,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="glass border-border/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <XIcon className="h-5 w-5" />
          X API Test Panel
        </CardTitle>
        <CardDescription>
          Test your X API connection and credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Button 
            onClick={testConnection} 
            disabled={testing}
            variant="outline"
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          
          <Button 
            onClick={testTweet} 
            disabled={testing}
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XIcon className="h-4 w-4 mr-2" />
            )}
            Post Test Tweet
          </Button>
        </div>

        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 mt-0.5 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertDescription>
                  <div className="font-semibold mb-1">{testResult.message}</div>
                  {testResult.data && (
                    <pre className="text-xs bg-muted/50 p-2 rounded mt-2 overflow-auto max-h-32">
                      {JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  )}
                  {testResult.error && (
                    <div className="text-xs mt-2">
                      <strong>Error details:</strong> {testResult.error.toString()}
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p><strong>Required Secrets:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>X Api Key (Consumer API Key)</li>
            <li>X Key Secret (Consumer API Secret)</li>
            <li>X Access TOken (OAuth Access Token)</li>
            <li>X Token Secret (OAuth Access Token Secret)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
