import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';

function TemplateForm({ groupId, template, onClose }: any) {
  const qc = useQueryClient();
  const [name, setName] = useState(template?.name || '');
  const [body, setBody] = useState(template?.body || '');

  const mutation = useMutation({
    mutationFn: () => template
      ? api.patch(`/templates/${template.id}`, { name, body })
      : api.post('/templates', { groupId, name, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-groups'] });
      qc.invalidateQueries({ queryKey: ['templates', groupId] });
      toast({ title: template ? 'Template updated' : 'Template created' });
      onClose();
    },
  });

  const insertVar = (v: string) => setBody((b: string) => b + `{${v}}`);

  return (
    <div className="px-6 lg:px-8 py-6 space-y-3">
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">Template Name</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Gentle Reminder – Day 2" />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-1">Message Body</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={5}
          placeholder="Namaste {Name} 🙏 ..."
          className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-evergreen-700"
        />
        <div className="flex flex-wrap gap-1 mt-2">
          {['Name','Date','GuestCount','EventType','VenueName'].map(v => (
            <button key={v} onClick={() => insertVar(v)} className="text-xs bg-slate-100 hover:bg-evergreen-50 text-slate-600 px-2 py-1 rounded-md border border-slate-200">
              {'{' + v + '}'}
            </button>
          ))}
        </div>
        {body && (
          <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm text-slate-600 border border-slate-100">
            <p className="text-xs text-slate-600 mb-1 font-medium">Preview</p>
            {body.replace(/\{Name\}/g,'Priya').replace(/\{Date\}/g,'15 Dec 2024').replace(/\{GuestCount\}/g,'300').replace(/\{EventType\}/g,'Wedding').replace(/\{VenueName\}/g,'Nahata Lawns')}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!name || !body || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Saving…' : template ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: any }) {
  const [expanded, setExpanded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const qc = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ['templates', group.id],
    queryFn: () => api.get(`/template-groups/${group.id}/templates`).then(r => r.data),
    enabled: expanded,
  });

  const deleteMutation = useMutation({
    mutationFn: (tId: string) => api.delete(`/templates/${tId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates', group.id] }); toast({ title: 'Template deleted' }); },
  });

  return (
    <Card>
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 rounded-t-xl"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{group.icon || '💬'}</span>
          <div>
            <h3 className="font-semibold text-slate-800">{group.name}</h3>
            <p className="text-xs text-slate-600">{group._count?.templates || 0} templates</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-slate-600" /> : <ChevronDown size={16} className="text-slate-600" />}
      </div>

      {expanded && (
        <CardContent className="pt-0 border-t border-slate-100">
          <div className="px-6 lg:px-8 py-6 space-y-2 mt-3">
            {(templates || []).map((t: any) => (
              <div key={t.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700">{t.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.body}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => { setEditTemplate(t); setFormOpen(true); }} className="p-1 text-slate-600 hover:text-evergreen-700">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(t.id)} className="p-1 text-slate-600 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Button variant="ghost" size="sm" className="mt-3 text-evergreen-700" onClick={() => { setEditTemplate(null); setFormOpen(true); }}>
            <Plus size={14} /> Add template to this group
          </Button>
        </CardContent>
      )}

      <Dialog open={formOpen} onOpenChange={v => { if (!v) { setFormOpen(false); setEditTemplate(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTemplate ? 'Edit Template' : 'Add Template'}</DialogTitle>
          </DialogHeader>
          <TemplateForm groupId={group.id} template={editTemplate} onClose={() => { setFormOpen(false); setEditTemplate(null); }} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function TemplatesPage() {
  const qc = useQueryClient();
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['template-groups'],
    queryFn: () => api.get('/template-groups').then(r => r.data),
  });

  const createGroupMutation = useMutation({
    mutationFn: () => api.post('/template-groups', { name: groupName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['template-groups'] }); setGroupName(''); setNewGroupOpen(false); toast({ title: 'Group created' }); },
  });

  return (
    <div className="px-6 lg:px-8 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-800">Templates</h1>
          <p className="text-slate-500 text-sm mt-0.5">Organise your WhatsApp messages your way</p>
        </div>
        <Button size="sm" onClick={() => setNewGroupOpen(true)}><Plus size={14} /> New Group</Button>
      </div>

      {isLoading ? (
        [...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)
      ) : (
        <div className="px-6 lg:px-8 py-6 space-y-3">
          {(groups || []).map((g: any) => <GroupCard key={g.id} group={g} />)}
        </div>
      )}

      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Template Group</DialogTitle></DialogHeader>
          <div className="px-6 lg:px-8 py-6 space-y-3">
            <Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Post-Visit Follow-up" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNewGroupOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={!groupName || createGroupMutation.isPending} onClick={() => createGroupMutation.mutate()}>Create</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
