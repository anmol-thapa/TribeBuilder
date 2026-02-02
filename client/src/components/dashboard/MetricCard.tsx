import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  growth: number;
  icon: LucideIcon;
  gradient: string;
}

export const MetricCard = ({ title, value, growth, icon: Icon, gradient }: MetricCardProps) => {
  const isPositive = growth > 0;
  const isNeutral = growth === 0;
  
  return (
    <Card className="glass border-border/20 hover-glow card-interactive relative overflow-hidden">
      <div className={`absolute inset-0 opacity-5 ${gradient}`}></div>
      <CardContent className="p-6 relative">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl ${gradient}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <Badge
            variant={isNeutral ? "secondary" : isPositive ? "default" : "destructive"}
            className="flex items-center space-x-1"
          >
            {isNeutral ? (
              <span className="text-base leading-none">—</span>
            ) : isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{Math.abs(growth)}%</span>
          </Badge>
        </div>
        
        <div className="space-y-1">
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
};
