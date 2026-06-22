// Manual column → field mapping for imported CSV/TXT, seeded by auto-detection.
import { useEffect, useState } from 'react';
import { Badge, Label, Select } from './ui';
import { MAPPABLE_FIELDS, type MappableField, type ParsedCsv } from '@/lib/csv';

export function FieldMapping({
  parsed,
  initial,
  onChange,
}: {
  parsed: ParsedCsv;
  initial: Record<string, MappableField>;
  onChange: (mapping: Record<string, MappableField>) => void;
}) {
  const [mapping, setMapping] = useState(initial);

  useEffect(() => {
    setMapping(initial);
  }, [initial]);

  function update(header: string, field: MappableField) {
    const next = { ...mapping, [header]: field };
    setMapping(next);
    onChange(next);
  }

  const preview = parsed.rows.slice(0, 4);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label>Column mapping</Label>
        {parsed.synthesizedHeaders && <Badge tone="warn">no header row — synthesized columns</Badge>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-bg-inset">
            <tr>
              {parsed.headers.map((h) => (
                <th key={h} className="border-b border-border px-2 py-2 align-top">
                  <div className="mb-1 mono text-slate-300">{h}</div>
                  <Select value={mapping[h] ?? 'ignore'} onChange={(e) => update(h, e.target.value as MappableField)}>
                    {MAPPABLE_FIELDS.map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.label}
                      </option>
                    ))}
                  </Select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((row, i) => (
              <tr key={i} className="odd:bg-bg-raised/40">
                {parsed.headers.map((h) => (
                  <td key={h} className="border-b border-border-subtle px-2 py-1.5 mono text-slate-400">
                    <span className="block max-w-[180px] truncate" title={row[h]}>
                      {row[h]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">
        Showing {preview.length} of {parsed.rows.length} rows. Adjust any column that was mapped
        incorrectly.
      </p>
    </div>
  );
}
