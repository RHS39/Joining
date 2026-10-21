import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Boxes,
  CalendarDays,
  CircleDollarSign,
  FileSpreadsheet,
  HardDrive,
  Image as ImageIcon,
  Layers,
  PlusCircle,
} from 'lucide-react';
import { useRecords } from '@/components/RecordsContext';
import { useSettings } from '@/components/SettingsContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatBytes, formatCurrency, formatDate, formatNumber } from '@/lib/format';

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card-surface flex items-start gap-3 px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        <p className="mt-1 truncate text-xl font-semibold text-ink-900">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { records, loading } = useRecords();
  const { settings } = useSettings();
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      if (!navigator.storage?.estimate) return;
      const estimate = await navigator.storage.estimate();
      if (cancelled) return;
      setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
    };
    void read();
    return () => {
      cancelled = true;
    };
  }, [records.length]);

  const stats = useMemo(() => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    let totalQuantity = 0;
    let totalAmount = 0;
    let recent7 = 0;
    let recent30 = 0;
    let withImages = 0;

    const categories = new Map<string, number>();

    records.forEach((record) => {
      if (record.quantity !== null) totalQuantity += record.quantity;
      if (record.totalAmount !== null) totalAmount += record.totalAmount;
      if (record.hasImage) withImages += 1;
      const created = new Date(record.createdAt).getTime();
      if (Number.isFinite(created)) {
        if (now - created <= sevenDays) recent7 += 1;
        if (now - created <= thirtyDays) recent30 += 1;
      }
      categories.set(record.category, (categories.get(record.category) ?? 0) + 1);
    });

    const categoryList = [...categories.entries()].sort((a, b) => b[1] - a[1]);
    const maxCategory = categoryList[0]?.[1] ?? 0;

    const recent = [...records]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    return { totalQuantity, totalAmount, recent7, recent30, withImages, categoryList, maxCategory, recent };
  }, [records]);

  const currency = settings.preferences.currency;
  const showQuantities = settings.preferences.showQuantities !== false;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-500">
            All numbers are calculated from the employee records stored in this browser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/records/new">
            <Button icon={<PlusCircle className="h-4 w-4" />}>Add employee</Button>
          </Link>
          <Link to="/reports">
            <Button variant="outline" icon={<FileSpreadsheet className="h-4 w-4" />}>
              Reports
            </Button>
          </Link>
        </div>
      </header>

      <div className={showQuantities ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4' : 'grid gap-4 sm:grid-cols-2'}>
        <StatCard icon={<Layers className="h-5 w-5" />} label="Total employees" value={formatNumber(records.length, 0)} />
        <StatCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Recently joined"
          value={formatNumber(stats.recent7, 0)}
          hint={`${stats.recent30} in the last 30 days`}
        />
        {showQuantities ? (
          <>
            <StatCard
              icon={<Boxes className="h-5 w-5" />}
              label="Total quantity"
              value={formatNumber(stats.totalQuantity, 2)}
            />
            <StatCard
              icon={<CircleDollarSign className="h-5 w-5" />}
              label="Total amount"
              value={formatCurrency(stats.totalAmount, currency)}
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recently joined"
            description="The most recently added employees."
            actions={
              <Link to="/records" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                View all
              </Link>
            }
          />
          <CardBody className="p-0">
            {loading ? (
              <p className="px-5 py-6 text-sm text-ink-500">Loading employees…</p>
            ) : stats.recent.length === 0 ? (
              <div className="px-5 py-6">
                <EmptyState
                  icon={<Layers className="h-6 w-6" />}
                  title="No employees yet"
                  description="Add your first employee to start building the register. Everything stays in this browser."
                  action={
                    <Link to="/records/new">
                      <Button icon={<PlusCircle className="h-4 w-4" />}>Add employee</Button>
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-ink-200">
                {stats.recent.map((record) => (
                  <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{record.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {record.recordId} · {formatDate(record.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.hasImage ? <ImageIcon className="h-4 w-4 text-ink-400" aria-label="Has a photo" /> : null}
                      <Badge tone="brand">{record.category}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Employees by category" />
            <CardBody>
              {stats.categoryList.length === 0 ? (
                <p className="text-sm text-ink-500">No data yet.</p>
              ) : (
                <ul className="space-y-3">
                  {stats.categoryList.map(([category, count]) => (
                    <li key={category}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate text-ink-700">{category}</span>
                        <span className="font-medium text-ink-900">{count}</span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(4, (count / stats.maxCategory) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Local storage" description="Everything is stored in this browser on this device." />
            <CardBody className="space-y-2 text-sm text-ink-600">
              <p className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-ink-400" aria-hidden="true" />
                  Used
                </span>
                <span className="font-medium text-ink-900">{formatBytes(storage?.usage ?? 0)}</span>
              </p>
              <p className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-ink-400" aria-hidden="true" />
                  Employees with a photo
                </span>
                <span className="font-medium text-ink-900">{stats.withImages}</span>
              </p>
              {storage && storage.quota > 0 ? (
                <div className="pt-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-ink-400"
                      style={{ width: `${Math.min(100, (storage.usage / storage.quota) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-500">of about {formatBytes(storage.quota)} available to the browser.</p>
                </div>
              ) : null}
              <p className="pt-1 text-xs text-ink-500">
                Storage is not encrypted and is not synchronised between devices. Export a backup from Import / Export.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
