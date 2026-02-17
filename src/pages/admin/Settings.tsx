import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Server, MessageSquare, AlertTriangle } from 'lucide-react';

interface SiteSetting {
  id: string;
  key: string;
  value: unknown;
}

const Settings: React.FC = () => {
  const [serverIp, setServerIp] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*');
      
      if (error) throw error;
      return data as SiteSetting[];
    }
  });

  useEffect(() => {
    if (settings) {
      const serverIpSetting = settings.find(s => s.key === 'server_ip');
      const discordSetting = settings.find(s => s.key === 'discord_url');
      const maintenanceSetting = settings.find(s => s.key === 'maintenance_mode');
      
      if (serverIpSetting) setServerIp(JSON.parse(String(serverIpSetting.value)) || '');
      if (discordSetting) setDiscordUrl(JSON.parse(String(discordSetting.value)) || '');
      if (maintenanceSetting) setMaintenanceMode(maintenanceSetting.value === true || maintenanceSetting.value === 'true');
    }
  }, [settings]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const existing = settings?.find(s => s.key === key);
      
      if (existing) {
        const { error } = await supabase
          .from('site_settings')
          .update({ value: JSON.stringify(value) })
          .eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('site_settings')
          .insert({ key, value: JSON.stringify(value) });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    }
  });

  const handleSaveAll = async () => {
    setIsSaving(true);
    
    try {
      await Promise.all([
        updateSettingMutation.mutateAsync({ key: 'server_ip', value: serverIp }),
        updateSettingMutation.mutateAsync({ key: 'discord_url', value: discordUrl }),
        updateSettingMutation.mutateAsync({ key: 'maintenance_mode', value: maintenanceMode }),
      ]);
      
      toast({ title: 'Success', description: 'Settings saved successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    }
    
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure server and site settings</p>
        </div>
        <Button className="gradient-primary" onClick={handleSaveAll} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save All
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="glass-card border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Server Settings
            </CardTitle>
            <CardDescription>
              Configure Minecraft server connection details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server_ip">Server IP</Label>
              <Input
                id="server_ip"
                value={serverIp}
                onChange={(e) => setServerIp(e.target.value)}
                placeholder="play.ragemc.ge"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Social Links
            </CardTitle>
            <CardDescription>
              Configure social media and community links
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="discord_url">Discord Invite URL</Label>
              <Input
                id="discord_url"
                value={discordUrl}
                onChange={(e) => setDiscordUrl(e.target.value)}
                placeholder="https://discord.gg/XfAK8GHDRY"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-border/30 border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Critical settings that affect site availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="maintenance_mode" className="text-base">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, users will see a maintenance page instead of the site
                </p>
              </div>
              <Switch
                id="maintenance_mode"
                checked={maintenanceMode}
                onCheckedChange={setMaintenanceMode}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
