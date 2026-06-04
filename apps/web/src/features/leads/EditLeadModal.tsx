import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  lead: any;         // the lead object to edit
}

export function EditLeadModal({ open, onClose, lead }: Props) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm({
    defaultValues: {
      name: '', primaryPhone: '', email: '',
      source: 'MANUAL', eventType: 'WEDDING',
      guestCount: '', eventDate: '', notes: '',
    },
  });

  // Pre-fill form whenever lead changes
  useEffect(() => {
    if (lead) {
      reset({
        name:         lead.name || '',
        primaryPhone: lead.primaryPhone || '',
        email:        lead.email || '',
        source:       lead.source || 'MANUAL',
        eventType:    lead.eventType || 'WEDDING',
        guestCount:   lead.guestCount ? String(lead.guestCount) : '',
        eventDate:    lead.eventDate ? lead.eventDate.slice(0, 10) : '',
        notes:        lead.notes || '',
      });
    }
  }, [lead, reset]);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      api.patch(`/leads/${lead.id}`, {
        ...data,
        guestCount: data.guestCount ? parseInt(data.guestCount) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead', lead?.id] });
      qc.invalidateQueries({ queryKey: ['pipeline-board'] });
      toast({ title: '✅ Lead updated successfully' });
      onClose();
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Update failed', description: err.response?.data?.error?.message || 'Please try again' });
    },
  });

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Lead — {lead.name}</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">Update the lead's details below</p>
        </DialogHeader>

        <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Couple / Name *</label>
              <Input {...register('name', { required: true })} placeholder="Priya & Aakash" className="h-10" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone (+91) *</label>
              <Input {...register('primaryPhone', { required: true })} placeholder="+919876543210" className="h-10" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
              <Input type="email" {...register('email')} placeholder="couple@email.com" className="h-10" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Source</label>
              <Select defaultValue={lead.source} onValueChange={v => setValue('source', v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['MANUAL','WEDMEGOOD','JUSTDIAL','GOOGLE_MAPS','WEBSITE','REFERRAL'].map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g,' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Event Type</label>
              <Select defaultValue={lead.eventType} onValueChange={v => setValue('eventType', v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['WEDDING','RECEPTION','ENGAGEMENT','SANGEET','BIRTHDAY','CORPORATE','OTHER'].map(e => (
                    <SelectItem key={e} value={e}>{e.charAt(0)+e.slice(1).toLowerCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Guest Count</label>
              <Input type="number" {...register('guestCount')} placeholder="450" className="h-10" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Event Date</label>
              <Input type="date" {...register('eventDate')} className="h-10" />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Any notes about this lead…"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#1F5C45]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} className="h-10">Cancel</Button>
            <Button
              type="submit"
              disabled={isSubmitting || mutation.isPending}
              className="h-10 bg-[#1F5C45] hover:bg-[#143d2e] text-white px-6"
            >
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
