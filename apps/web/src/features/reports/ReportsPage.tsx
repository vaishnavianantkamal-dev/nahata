import { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const reports = [
  { key: 'leads', label: 'Leads Report', desc: 'All leads with source, stage, owner, score, event details' },
  { key: 'source-performance', label: 'Source Performance', desc: 'Leads, bookings & win rate per source' },
  { key: 'calls', label: 'Calls Report', desc: 'Calls with direction, duration, AI summary & score' },
];

export function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const download = (key: string, format: 'csv' | 'xlsx') => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const url = `/api/v1/reports/${key}.${format}?${params}`;
    const token = localStorage.getItem('access_token');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${key}-${new Date().toLocaleDateString('en-IN').replace(/\//g,'-')}.${format}`;
        a.click();
      });
  };

  return (
    <div className="px-6 lg:px-8 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-800">Reports</h1>
        <p className="text-slate-500 text-sm mt-0.5">Download performance reports any time</p>
      </div>

      {/* Date range */}
      <div className="flex gap-3 items-center bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">From</label>
          <Input type="date" className="w-36" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">To</label>
          <Input type="date" className="w-36" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      <div className="px-6 lg:px-8 py-6 space-y-3">
        {reports.map(r => (
          <Card key={r.key}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">{r.label}</h3>
                <p className="text-sm text-slate-600 mt-0.5">{r.desc}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => download(r.key, 'csv')}>
                  <Download size={13} /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => download(r.key, 'xlsx')}>
                  <FileSpreadsheet size={13} /> XLSX
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
