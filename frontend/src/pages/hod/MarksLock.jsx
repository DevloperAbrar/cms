import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock } from 'lucide-react';
import { hodApi } from '../../api/hod.api';
import { getSemestersForYear } from '../../utils/semester';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import toast from 'react-hot-toast';

const HODMarksLock = () => {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ branch_id: '', year: '', semester: '' });

  const { data: branches = [] } = useQuery({
    queryKey: ['hod-branches'],
    queryFn: hodApi.getDeptBranches,
  });

  const { data: subjects = [], isLoading: ls } = useQuery({
    queryKey: ['hod-subjects', filters.branch_id, filters.year, filters.semester],
    queryFn: () => hodApi.getDeptSubjects({
      branch_id: filters.branch_id,
      year: filters.year,
      semester: filters.semester,
    }),
    enabled: !!(filters.branch_id && filters.year && filters.semester),
  });

  const firstSubject = subjects[0];
  const { data: patternData } = useQuery({
    queryKey: ['hod-lock-pattern', firstSubject?._id, filters.semester],
    queryFn: () => hodApi.getExamPattern({
      year: Number(filters.year),
      semester: Number(filters.semester),
    }),
    enabled: !!(firstSubject && filters.semester),
  });

  const components = patternData?.components || [];

  const handleLock = async (sub, comp) => {
    try {
      await hodApi.lockComponent({
        subject_id:        sub._id,
        branch_id:         filters.branch_id,
        year:              Number(filters.year),
        exam_component_id: comp._id,
      });
      // Invalidate all lock-status queries so every row re-fetches
      qc.invalidateQueries({ queryKey: ['hod-lock-status'] });
      toast.success(`${comp.name} locked`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleUnlock = async (sub, comp) => {
    try {
      await hodApi.unlockComponent({
        subject_id:        sub._id,
        branch_id:         filters.branch_id,
        year:              Number(filters.year),
        exam_component_id: comp._id,
      });
      qc.invalidateQueries({ queryKey: ['hod-lock-status'] });
      toast.success(`${comp.name} unlocked`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const ready = !!(filters.branch_id && filters.year && filters.semester);

  return (
    <div className="space-y-4">
      <PageHeader title="Marks Lock / Unlock" description="Control marks submission for each component" />

      <div className="card p-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Branch</label>
            <select
              className="input"
              value={filters.branch_id}
              onChange={(e) => setFilters((p) => ({ ...p, branch_id: e.target.value }))}
            >
              <option value="">Select branch</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Year</label>
            <select
              className="input"
              value={filters.year}
              onChange={(e) => setFilters((p) => ({ ...p, year: e.target.value, semester: '' }))}
            >
              <option value="">Year</option>
              {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Semester</label>
            <select
              className="input"
              value={filters.semester}
              disabled={!filters.year}
              onChange={(e) => setFilters((p) => ({ ...p, semester: e.target.value }))}
            >
              <option value="">Semester</option>
              {getSemestersForYear(filters.year).map((s) => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!ready && (
        <EmptyState title="Select filters above" description="Choose branch, year, and semester to manage marks locks." />
      )}

      {ready && (
        <div className="card">
          {ls ? <LoadingSpinner className="py-8" /> : subjects.length === 0 ? (
            <EmptyState title="No subjects found" description="No subjects configured for this selection." />
          ) : components.length === 0 ? (
            <EmptyState title="No exam pattern found" description="Create an exam pattern for this year + semester first." />
          ) : (
            <div className="divide-y divide-gray-100">
              {subjects.map((sub) => (
                <div key={sub._id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-gray-900 mb-3">
                    {sub.name}{' '}
                    <span className="text-gray-400 font-normal text-xs">({sub.code})</span>
                  </p>
                  <div className="space-y-2">
                    {components.map((comp) => (
                      <ComponentLockRow
                        key={comp._id}
                        comp={comp}
                        sub={sub}
                        filters={filters}
                        onLock={() => handleLock(sub, comp)}
                        onUnlock={() => handleUnlock(sub, comp)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ComponentLockRow = ({ comp, sub, filters, onLock, onUnlock }) => {
  const [pending, setPending] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hod-lock-status', sub._id, comp._id, filters.branch_id, filters.year],
    queryFn: () => hodApi.getMarksLockStatus({
      subject_id:        sub._id,
      branch_id:         filters.branch_id,
      year:              Number(filters.year),
      exam_component_id: comp._id,
    }),
    // no staleTime — always fetch fresh when invalidated
  });

  const isLocked = data?.locked ?? false;

  const handleAction = async (action) => {
    setPending(true);
    try {
      await action();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 border transition-colors ${
      isLocked
        ? 'bg-red-50 border-red-200'
        : 'bg-green-50 border-green-200'
    }`}>
      <div className="flex items-center gap-2">
        {isLoading ? (
          <div className="h-3.5 w-3.5 rounded-full bg-gray-200 animate-pulse" />
        ) : isLocked ? (
          <Lock className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <Unlock className="h-3.5 w-3.5 text-green-600" />
        )}
        <span className="text-sm font-medium text-gray-800">{comp.name}</span>
        <span className="text-xs text-gray-400">/ {comp.max_marks} marks</span>
        {isLocked && (
          <span className="text-xs bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
            Locked
          </span>
        )}
        {!isLocked && !isLoading && (
          <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
            Open
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {/* Lock button — shown when unlocked */}
        <button
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            isLocked || pending
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
          onClick={() => !isLocked && !pending && handleAction(onLock)}
          disabled={isLocked || pending}
        >
          <Lock className="h-3 w-3" /> Lock
        </button>

        {/* Unlock button — shown when locked */}
        <button
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            !isLocked || pending
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-700 hover:bg-gray-800 text-white'
          }`}
          onClick={() => isLocked && !pending && handleAction(onUnlock)}
          disabled={!isLocked || pending}
        >
          <Unlock className="h-3 w-3" /> Unlock
        </button>
      </div>
    </div>
  );
};

export default HODMarksLock;