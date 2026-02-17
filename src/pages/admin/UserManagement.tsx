import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, UserCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  discord_id: string | null;
  minecraft_nickname: string | null;
  created_at: string;
}

type AppRole = 'owner' | 'manager' | 'admin' | 'support' | 'moder' | 'helper' | 'user';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

const ROLE_RANK: Record<AppRole, number> = {
  owner: 0,
  manager: 1,
  admin: 2,
  support: 3,
  moder: 4,
  helper: 5,
  user: 6,
};

const roleColors: Record<AppRole, string> = {
  owner: 'bg-red-500/20 text-red-500',
  manager: 'bg-orange-500/20 text-orange-500',
  admin: 'bg-yellow-500/20 text-yellow-500',
  support: 'bg-blue-500/20 text-blue-500',
  moder: 'bg-purple-500/20 text-purple-500',
  helper: 'bg-green-500/20 text-green-500',
  user: 'bg-gray-500/20 text-gray-500'
};

const UserManagement: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['admin-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Profile[];
    }
  });

  const { data: allRoles } = useQuery({
    queryKey: ['admin-user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*');
      
      if (error) throw error;
      return data as UserRole[];
    }
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error: upsertError } = await supabase
        .from('user_roles')
        .upsert([{ user_id: userId, role }], { onConflict: 'user_id,role' });

      if (upsertError) throw upsertError;

      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .neq('role', role);

      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-roles'] });
      toast({ title: 'Success', description: 'User role updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const getUserRole = (userId: string): AppRole => {
    const matches = allRoles?.filter((entry) => entry.user_id === userId) ?? [];
    if (!matches.length) return 'user';

    let best: AppRole = 'user';
    for (const entry of matches) {
      if (ROLE_RANK[entry.role] < ROLE_RANK[best]) best = entry.role;
    }

    return best;
  };

  const handleViewUser = (user: Profile) => {
    setSelectedUser(user);
    const roles = allRoles?.filter(r => r.user_id === user.id) || [];
    setUserRoles(roles);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage users and assign roles</p>
      </div>

      <Card className="glass-card border-border/30">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Discord</TableHead>
                  <TableHead>Minecraft</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles?.map((profile) => {
                  const role = getUserRole(profile.id);
                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile.avatar_url || ''} />
                            <AvatarFallback>
                              {profile.username?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{profile.username || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {profile.discord_id || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {profile.minecraft_nickname || '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={role}
                          onValueChange={(value) =>
                            updateRoleMutation.mutate({ userId: profile.id, role: value as AppRole })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <Badge className={roleColors[role]}>
                              {role}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="helper">Helper</SelectItem>
                            <SelectItem value="moder">Moderator</SelectItem>
                            <SelectItem value="support">Support</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(profile.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewUser(profile)}>
                          <UserCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!profiles || profiles.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            User Profile
          </DialogTitle>
          <DialogDescription>
            See the profile details and assigned roles before promoting or demoting anyone.
          </DialogDescription>
        </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedUser.avatar_url || ''} />
                  <AvatarFallback className="text-2xl">
                    {selectedUser.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{selectedUser.username || 'Unknown'}</h3>
                  <p className="text-sm text-muted-foreground font-mono">{selectedUser.id}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Discord ID</p>
                  <p>{selectedUser.discord_id || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Minecraft</p>
                  <p>{selectedUser.minecraft_nickname || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Joined</p>
                  <p>{format(new Date(selectedUser.created_at), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Role(s)</p>
                  <div className="flex gap-1 flex-wrap">
                    {userRoles.length > 0 ? (
                      userRoles.map((r) => (
                        <Badge key={r.id} className={roleColors[r.role]}>
                          {r.role}
                        </Badge>
                      ))
                    ) : (
                      <Badge className={roleColors.user}>user</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
