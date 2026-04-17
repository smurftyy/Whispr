import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';

export function useReminders() {
  return useQuery({
    queryKey: ['reminders'],
    queryFn: () => api.get('/api/reminders').then(r => r.data),
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/api/reminders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  });
}

export function useExtractReminder() {
  return useMutation({
    mutationFn: (text) => api.post('/api/reminders/extract', { text }).then(r => r.data),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/api/reminders', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/api/reminders/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] }),
  });
}