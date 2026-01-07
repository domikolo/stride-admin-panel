/**
 * Clients Page (Owner Only)
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getClients } from '@/lib/api';
import { Client } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'owner') {
      loadClients();
    } else if (user) {
      setError('Access denied. Owner role required.');
      setLoading(false);
    }
  }, [user]);

  const loadClients = async () => {
    try {
      const data = await getClients();
      setClients(data.clients);
      setError(null);
    } catch (error) {
      console.error('Failed to load clients:', error);
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-white">Clients</h1>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (user?.role !== 'owner') {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-white">Clients</h1>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          Access denied. Owner role required.
        </div>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'paused':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
          Clients
        </h1>
        {/* Future: Add Client button */}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <Card className="glass-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Company Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Conversations</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-zinc-500">
                  No clients found
                </TableCell>
              </TableRow>
            ) : (
              clients.map((client) => (
                <TableRow key={client.client_id}>
                  <TableCell className="font-mono text-sm">{client.client_id}</TableCell>
                  <TableCell className="font-medium">{client.company_name}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(client.status)}>
                      {client.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{client.total_conversations}</TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {new Date(client.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
