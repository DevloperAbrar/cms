import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link2, Copy, Trash2 } from 'lucide-react';
import { coordinatorApi } from '../../api/coordinator.api';
import { PageHeader } from '../../components/common/PageHeader';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const CoordinatorParentURL = () => {
  const { user } = useAuthStore();
  const branches = user?.coordinator_branches || [];

  // Correctly extract the actual branch _id (not the coordinator_branches entry _id)
  const getActualBranchId = (b) => b.branch_id?._id || b.branch_id || '';

  const [branchId, setBranchId] = useState(getActualBranchId(branches[0] || {}));
  const [selectedStudent, setSelectedStudent] = useState('');
  const [expiry, setExpiry] = useState('30d');
  const [generated, setGenerated] = useState(null);

  const { data: students = [] } = useQuery({
    queryKey: ['coordinator-branch-students', branchId],
    queryFn: () => coordinatorApi.getBranchStudents({ branch_id: branchId }),
    enabled: !!branchId,
  });

  const generate = useMutation({
    mutationFn: coordinatorApi.generateParentURL,
    onSuccess: (data) => { setGenerated(data.url || data.data?.url); toast.success('URL generated'); },
    onError: (e) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: coordinatorApi.revokeParentURL,
    onSuccess: () => { setGenerated(null); toast.success('URL revoked'); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Parent URL" description="Generate parent access links for branch students" />

      <div className="card p-6 space-y-4">
        {branches.length > 1 && (
          <div>
            <label className="label">Branch</label>
            <select className="input w-64" value={branchId}
              onChange={(e) => { setBranchId(e.target.value); setSelectedStudent(''); setGenerated(null); }}>
              {branches.map((b) => {
                const id = getActualBranchId(b);
                const name = b.branch_id?.name || id;
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
          </div>
        )}

        <div>
          <label className="label">Select Student</label>
          <select className="input w-full sm:w-96" value={selectedStudent}
            onChange={(e) => { setSelectedStudent(e.target.value); setGenerated(null); }}>
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s._id} value={s._id}>{s.name} ({s.enrollment_number})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Expiry</label>
          <select className="input w-48" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="permanent">Permanent</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button
            className="btn-primary"
            onClick={() => generate.mutate({ student_id: selectedStudent, branch_id: branchId, expiry })}
            disabled={generate.isPending || !selectedStudent}
          >
            <Link2 className="h-4 w-4" />
            {generate.isPending ? 'Generating...' : 'Generate URL'}
          </button>
          {generated && (
            <button
              className="btn-danger btn-sm"
              onClick={() => revoke.mutate({ student_id: selectedStudent, branch_id: branchId })}
              disabled={revoke.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" /> Revoke
            </button>
          )}
        </div>

        {generated && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-semibold text-green-700 mb-2">Generated URL:</p>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-700 flex-1 break-all font-mono">{generated}</p>
              <button
                onClick={() => { navigator.clipboard.writeText(generated); toast.success('Copied'); }}
                className="btn-secondary btn-sm flex-shrink-0"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoordinatorParentURL;