'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, ChevronUp, ChevronDown, Trash2, Save, X, Search } from 'lucide-react';

interface TemplateItem {
  id?: string;
  text: string;
  maxScore: number;
  sortOrder: number;
}

interface TemplateSection {
  id?: string;
  title: string;
  sortOrder: number;
  items: TemplateItem[];
}

interface Template {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sections: TemplateSection[];
  _count?: { audits: number };
}

const emptyTemplate = (): Template => ({
  id: '',
  code: '',
  name: '',
  description: '',
  sections: [],
});

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/templates');
    const data = await res.json();
    setTemplates(data.templates || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setEditing(emptyTemplate());
  }

  function startEdit(t: Template) {
    setEditing(JSON.parse(JSON.stringify(t)));
  }

  function addSection() {
    if (!editing) return;
    setEditing({
      ...editing,
      sections: [...editing.sections, { title: '', sortOrder: editing.sections.length, items: [] }],
    });
  }

  function updateSection(idx: number, title: string) {
    if (!editing) return;
    const sections = [...editing.sections];
    sections[idx].title = title;
    setEditing({ ...editing, sections });
  }

  function removeSection(idx: number) {
    if (!editing) return;
    const sections = editing.sections.filter((_, i) => i !== idx);
    setEditing({ ...editing, sections: sections.map((s, i) => ({ ...s, sortOrder: i })) });
  }

  function moveSection(idx: number, dir: number) {
    if (!editing) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= editing.sections.length) return;
    const sections = [...editing.sections];
    [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
    setEditing({ ...editing, sections: sections.map((s, i) => ({ ...s, sortOrder: i })) });
  }

  function addItem(sIdx: number) {
    if (!editing) return;
    const sections = [...editing.sections];
    sections[sIdx].items.push({ text: '', maxScore: 5, sortOrder: sections[sIdx].items.length });
    setEditing({ ...editing, sections });
  }

  function updateItem(sIdx: number, iIdx: number, field: keyof TemplateItem, value: string | number) {
    if (!editing) return;
    const sections = [...editing.sections];
    (sections[sIdx].items[iIdx] as any)[field] = value;
    setEditing({ ...editing, sections });
  }

  function removeItem(sIdx: number, iIdx: number) {
    if (!editing) return;
    const sections = [...editing.sections];
    sections[sIdx].items = sections[sIdx].items.filter((_, i) => i !== iIdx).map((it, i) => ({ ...it, sortOrder: i }));
    setEditing({ ...editing, sections });
  }

  function moveItem(sIdx: number, iIdx: number, dir: number) {
    if (!editing) return;
    const newIdx = iIdx + dir;
    if (newIdx < 0 || newIdx >= editing.sections[sIdx].items.length) return;
    const sections = [...editing.sections];
    const items = [...sections[sIdx].items];
    [items[iIdx], items[newIdx]] = [items[newIdx], items[iIdx]];
    sections[sIdx].items = items.map((it, i) => ({ ...it, sortOrder: i }));
    setEditing({ ...editing, sections });
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.code || !editing.name) {
      toast.error('Code and name are required');
      return;
    }
    if (editing.sections.some((s) => !s.title)) {
      toast.error('All sections need a title');
      return;
    }
    if (editing.sections.some((s) => s.items.some((i) => !i.text))) {
      toast.error('All items need text');
      return;
    }

    setSaving(true);
    const isNew = !editing.id;
    const url = isNew ? '/api/templates' : `/api/templates/${editing.id}`;
    const method = isNew ? 'POST' : 'PUT';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setSaving(false);

    if (res.ok) {
      toast.success(isNew ? 'Template created' : 'Template updated');
      setEditing(null);
      load();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to save template');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Template deleted');
      load();
    } else {
      toast.error('Failed to delete template');
    }
  }

  const filtered = templates.filter((t) =>
    `${t.name} ${t.code} ${t.description || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <PageHeader title="Audit Templates" description="Build and manage checklist templates">
        <Button onClick={startCreate} className="gap-2"><Plus className="h-4 w-4" /> New Template</Button>
      </PageHeader>

      {editing ? (
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="template-code" />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Template name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Sections</h3>
              <Button type="button" variant="outline" size="sm" onClick={addSection} className="gap-1">
                <Plus className="h-4 w-4" /> Add Section
              </Button>
            </div>

            <div className="space-y-4">
              {editing.sections.map((section, sIdx) => (
                <div key={sIdx} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input value={section.title} onChange={(e) => updateSection(sIdx, e.target.value)} placeholder="Section title" />
                    <Button type="button" size="icon" variant="ghost" onClick={() => moveSection(sIdx, -1)} disabled={sIdx === 0}><ChevronUp className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => moveSection(sIdx, 1)} disabled={sIdx === editing.sections.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => removeSection(sIdx)}><Trash2 className="h-4 w-4" /></Button>
                  </div>

                  <div className="pl-4 space-y-2">
                    {section.items.map((item, iIdx) => (
                      <div key={iIdx} className="flex items-center gap-2">
                        <Input value={item.text} onChange={(e) => updateItem(sIdx, iIdx, 'text', e.target.value)} placeholder="Checklist item" className="flex-1" />
                        <Input
                          type="number"
                          value={item.maxScore}
                          onChange={(e) => updateItem(sIdx, iIdx, 'maxScore', parseFloat(e.target.value) || 0)}
                          className="w-24"
                          min={0}
                          step={0.5}
                          title="Max score"
                        />
                        <Button type="button" size="icon" variant="ghost" onClick={() => moveItem(sIdx, iIdx, -1)} disabled={iIdx === 0}><ChevronUp className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" onClick={() => moveItem(sIdx, iIdx, 1)} disabled={iIdx === section.items.length - 1}><ChevronDown className="h-4 w-4" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => removeItem(sIdx, iIdx)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => addItem(sIdx)} className="gap-1">
                      <Plus className="h-4 w-4" /> Add Item
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)} className="gap-1"><X className="h-4 w-4" /> Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Template'}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search templates..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No templates found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((t) => (
                <div key={t.id} className="rounded-lg border p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{t.name} <span className="text-slate-500 font-normal">({t.code})</span></p>
                      <p className="text-sm text-slate-500">{t.description || 'No description'} · {t.sections.length} sections · {t.sections.reduce((sum, s) => sum + s.items.length, 0)} items</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {t._count?.audits ? <Badge variant="outline">{t._count.audits} audits</Badge> : null}
                      <Button size="sm" variant="outline" onClick={() => startEdit(t)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(t.id)} disabled={(t._count?.audits || 0) > 0}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
