import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Link2, Copy, Trash2 } from 'lucide-react';
import { hodApi } from '../../api/hod.api';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import toast from 'react-hot-toast';

const HODParentURL = () => {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [expiry, setExpiry] = useState('30d');
  const [generated, setGenerated] = useState(null);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['hod-students'],
    queryFn: hodApi.getDeptStudents,
  });

  const generate = useMutation({
    mutationFn: hodApi.generateParentURL,
    onSuccess: (data) => {
      setGenerated(data.url || data.data?.url);
      toast.success('Parent URL generated');
    },
    onError: (e) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: hodApi.revokeParentURL,
    onSuccess: () => { setGenerated(null); toast.success('URL revoked'); },
    onError: (e) => toast.error(e.message),
  });

  const handleGenerate = () => {
    if (!selectedStudent) return toast.error('Select a student first');
    generate.mutate({ student_id: selectedStudent, expiry });
  };

  const handleCopy = () => {
    if (generated) {
      navigator.clipboard.writeText(generated);
      toast.success('URL copied to clipboard');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Parent URL" description="Generate read-only parent access links for students" />

      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Select Student</label>
          <select
            className="input w-full sm:w-96"
            value={selectedStudent}
            onChange={(e) => { setSelectedStudent(e.target.value); setGenerated(null); }}
          >
            <option value="">Select a student</option>
            {students.map((s) => (
              <option key={s._id} value={s._id}>{s.name} ({s.enrollment_number})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Link Expiry</label>
          <select className="input w-48" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="permanent">Permanent</option>
          </select>
        </div>

        <div className="flex gap-3">
          <button className="btn-primary" onClick={handleGenerate} disabled={generate.isPending || !selectedStudent}>
            <Link2 className="h-4 w-4" />
            {generate.isPending ? 'Generating...' : 'Generate URL'}
          </button>
          {generated && (
            <button className="btn-danger btn-sm" onClick={() => revoke.mutate({ student_id: selectedStudent })} disabled={revoke.isPending}>
              <Trash2 className="h-3.5 w-3.5" /> Revoke
            </button>
          )}
        </div>

        {generated && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-semibold text-green-700 mb-2">Generated URL:</p>
            <div className="flex items-center gap-3">
              <p className="text-sm text-gray-700 flex-1 break-all font-mono">{generated}</p>
              <button onClick={handleCopy} className="btn-secondary btn-sm flex-shrink-0">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HODParentURL;