import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Table } from '../../components/common/Table';
import { superadminApi } from '../../api/superadmin.api';
import { downloadBlob } from '../../utils/csvTemplateGenerator';
import toast from 'react-hot-toast';

const AuditLogsPage = () => {
  const [filters, setFilters] = useState({ action: '', resource_type: '', from: '', to: '', page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => superadminApi.getAuditLogs(filters),
    keepPreviousData: true,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const handleExport = async () => {
    try {
      const res = await superadminApi.exportAuditLogs({ from: filters.from, to: filters.to });
      downloadBlob(res.data, 'audit_logs.csv');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const cols = [
    { key: 'actor_name', header: 'Actor' },
    { key: 'actor_role', header: 'Role' },
    { key: 'action', header: 'Action' },
    { key: 'resource_type', header: 'Resource' },
    { key: 'ip_address', header: 'IP Address' },
    {
      key: 'created_at', header: 'Timestamp',
      render: (r) => new Date(r.created_at).toLocaleString('en-IN'),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="All write actions across the system"
        action={
          <button className="btn-secondary" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        }
      />

      {/* Filters */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="label">Action</label>
            <input
              className="input"
              placeholder="CREATE, UPDATE..."
              value={filters.action}
              onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value, page: 1 }))}
            />
          </div>
          <div>
            <label className="label">Resource</label>
            <input
              className="input"
              placeholder="User, Marks..."
              value={filters.resource_type}
              onChange={(e) => setFilters((p) => ({ ...p, resource_type: e.target.value, page: 1 }))}
            />
          </div>
          <div>
            <label className="label">From</label>
            <input
              type="date"
              className="input"
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value, page: 1 }))}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              className="input"
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value, page: 1 }))}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <Table
          columns={cols}
          data={logs}
          isLoading={isLoading}
          emptyTitle="No audit logs found"
        />
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">Total: {total} records</p>
            <div className="flex gap-2">
              <button
                className="btn-secondary btn-sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
              >
                Previous
              </button>
              <span className="text-sm text-gray-700 px-2 py-1">
                {filters.page} / {pages}
              </span>
              <button
                className="btn-secondary btn-sm"
                disabled={filters.page >= pages}
                onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogsPage;