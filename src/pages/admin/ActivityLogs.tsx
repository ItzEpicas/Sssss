import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const actionColors: Record<string, string> = {
  create: 'bg-green-500/20 text-green-500',
  update: 'bg-blue-500/20 text-blue-500',
  delete: 'bg-red-500/20 text-red-500',
  login: 'bg-purple-500/20 text-purple-500',
  default: 'bg-gray-500/20 text-gray-500'
};

const getActionColor = (action: string): string => {
  if (action.includes('create') || action.includes('add')) return actionColors.create;
  if (action.includes('update') || action.includes('edit')) return actionColors.update;
  if (action.includes('delete') || action.includes('remove')) return actionColors.delete;
  if (action.includes('login') || action.includes('auth')) return actionColors.login;
  return actionColors.default;
};

const ActivityLogs: React.FC = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['admin-activity-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">Activity Logs</h1>
        <p className="text-muted-foreground">View recent admin actions and system events</p>
      </div>

      <Card className="glass-card border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {logs?.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          by {log.user_id ? 'Admin' : 'System'}
                        </span>
                      </div>
                      {log.details && (
                        <pre className="text-xs text-muted-foreground bg-background/50 p-2 rounded mt-2 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                ))}
                {(!logs || logs.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    No activity logs yet
                  </p>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLogs;
