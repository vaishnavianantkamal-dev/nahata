/**
 * useCmsLists — fetches + manages the CMS-configurable option lists.
 * Components use this hook so any change to settings is instantly reflected
 * everywhere (NewLeadModal, EditLeadModal, Leads table, etc.).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from './use-toast';

// ── Base (fixed) options — cannot be deleted ──────────────────────────────
export const BASE_EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'WEDDING',    label: 'Wedding' },
  { value: 'RECEPTION',  label: 'Reception' },
  { value: 'ENGAGEMENT', label: 'Engagement' },
  { value: 'SANGEET',    label: 'Sangeet' },
  { value: 'BIRTHDAY',   label: 'Birthday' },
  { value: 'CORPORATE',  label: 'Corporate' },
  // No "OTHER" — users add custom types instead
];

export const BASE_SOURCES: { value: string; label: string }[] = [
  { value: 'WEDMEGOOD',        label: 'WedMeGood' },
  { value: 'JUSTDIAL',         label: 'JustDial' },
  { value: 'GOOGLE_MAPS',      label: 'Google Maps' },
  { value: 'WEBSITE',          label: 'Website' },
  { value: 'MANUAL',           label: 'Manual Entry' },
  { value: 'REFERRAL',         label: 'Referral' },
  { value: 'WHATSAPP_INBOUND', label: 'WhatsApp Inbound' },
  { value: 'IVR_INBOUND',      label: 'IVR Call' },
  // No "OTHER"
];

export function useCmsLists() {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  const customEventTypes: string[] = settings?.customEventTypes ?? [];
  const customSources:    string[] = settings?.customSources    ?? [];

  // All event types = base + custom (no "Other")
  const allEventTypes = [
    ...BASE_EVENT_TYPES,
    ...customEventTypes.map((label: string) => ({ value: `CUSTOM::${label}`, label })),
  ];

  // All sources = base + custom
  const allSources = [
    ...BASE_SOURCES,
    ...customSources.map((label: string) => ({ value: `CUSTOM::${label}`, label })),
  ];

  // ── Mutation helpers ──────────────────────────────────────────────────
  const saveEventTypes = useMutation({
    mutationFn: (list: string[]) =>
      api.put('/settings/customEventTypes', { value: list }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: '✅ Event types updated' });
    },
  });

  const saveSources = useMutation({
    mutationFn: (list: string[]) =>
      api.put('/settings/customSources', { value: list }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: '✅ Sources updated' });
    },
  });

  const addEventType = (label: string) => {
    if (!label.trim()) return;
    if (allEventTypes.some(t => t.label.toLowerCase() === label.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Already exists', description: `"${label}" is already in the list.` });
      return;
    }
    saveEventTypes.mutate([...customEventTypes, label.trim()]);
  };

  const removeEventType = (label: string) =>
    saveEventTypes.mutate(customEventTypes.filter((t: string) => t !== label));

  const renameEventType = (oldLabel: string, newLabel: string) =>
    saveEventTypes.mutate(customEventTypes.map((t: string) => (t === oldLabel ? newLabel.trim() : t)));

  const addSource = (label: string) => {
    if (!label.trim()) return;
    if (allSources.some(s => s.label.toLowerCase() === label.toLowerCase())) {
      toast({ variant: 'destructive', title: 'Already exists', description: `"${label}" is already in the list.` });
      return;
    }
    saveSources.mutate([...customSources, label.trim()]);
  };

  const removeSource = (label: string) =>
    saveSources.mutate(customSources.filter((s: string) => s !== label));

  const renameSource = (oldLabel: string, newLabel: string) =>
    saveSources.mutate(customSources.map((s: string) => (s === oldLabel ? newLabel.trim() : s)));

  return {
    isLoading,
    customEventTypes,
    customSources,
    allEventTypes,
    allSources,
    addEventType,
    removeEventType,
    renameEventType,
    addSource,
    removeSource,
    renameSource,
    saving: saveEventTypes.isPending || saveSources.isPending,
  };
}
