import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listColleges, createCollege, updateCollege, regeneratePassword, renewCollege,
  suspendCollege, softDeleteCollege, reactivateCollege, purgeCollege
} from '../../api/platform.api';
import CreateCollegeModal from './components/CreateCollegeModal';
import EditCollegeModal from './components/EditCollegeModal';
import RenewModal from './components/RenewModal';
import PurgeModal from './components/PurgeModal';

const STATUS_COLORS = {
  trial: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  grace: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  expired: 'bg-red-500/10 text-red-400 border-red-500/30',
  suspended: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
};

const LIFECYCLE_COLORS = {
  active: 'text-gray-300',
  soft_deleted: 'text-red-400',
  purged: 'text-gray-500 line-through',
};

export default function PlatformDashboard() {
  const navigate = useNavigate();
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [renewTarget, setRenewTarget] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await listColleges();
      setColleges(res.data ?? []);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('platform_token');
        navigate('/platform/login');
      } else {
        setError('Failed to load colleges');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    await createCollege(data);
    setShowCreate(false);
    load();
  };

  const handleEdit = async (collegeId, data, newPassword) => {
    await updateCollege(collegeId, data);
    if (newPassword) {
      await regeneratePassword(collegeId, { newPassword });
    }
    setEditTarget(null);
    load();
  };

  const handleRenew = async (collegeId, months) => {
    setActionLoading(collegeId);
    try {
      await renewCollege(collegeId, { durationMonths: months });
      setRenewTarget(null);
      load();
    } finally {
      setActionLoading('');
    }
  };

  const handleSuspend = async (college) => {
    if (!confirm(`Suspend "${college.name}"? Users will be locked out immediately.`)) return;
    setActionLoading(college.id);
    try {
      await suspendCollege(college.id, { note: 'Suspended by platform owner' });
      load();
    } finally {
      setActionLoading('');
    }
  };

  const handleSoftDelete = async (college) => {
    if (!confirm(`Mark "${college.name}" for deletion? Data is preserved, all access is revoked.`)) return;
    setActionLoading(college.id);
    try {
      await softDeleteCollege(college.id);
      load();
    } finally {
      setActionLoading('');
    }
  };

  const handleReactivate = async (college) => {
    setActionLoading(college.id);
    try {
      await reactivateCollege(college.id);
      load();
    } finally {
      setActionLoading('');
    }
  };

  const handlePurge = async (collegeId, confirmCode) => {
    await purgeCollege(collegeId, confirmCode);
    setPurgeTarget(null);
    load();
  };

  const logout = () => {
    localStorage.removeItem('platform_token');
    navigate('/platform/login');
  };

  const stats = {
    total: colleges.length,
    active: colleges.filter(c => c.subscriptionStatus === 'active' && c.lifecycleStatus === 'active').length,
    expiring: colleges.filter(c => {
      const daysLeft = Math.ceil((new Date(c.subscriptionEnd) - new Date()) / 86400000);
      return daysLeft <= 30 && daysLeft > 0 && c.subscriptionStatus === 'active';
    }).length,
    expired: colleges.filter(c => c.subscriptionStatus === 'expired' || c.subscriptionStatus === 'suspended').length,
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-white text-sm">Campus CMS Platform</h1>
            <p className="text-xs text-gray-500">Platform Owner Console</p>
          </div>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-white transition-colors">
          Sign out
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Colleges', value: stats.total, color: 'text-white' },
            { label: 'Active', value: stats.active, color: 'text-green-400' },
            { label: 'Expiring (30d)', value: stats.expiring, color: 'text-yellow-400' },
            { label: 'Expired / Suspended', value: stats.expired, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white">Colleges</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            <span>+</span> New College
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-500 text-sm">Loading colleges...</div>
          ) : colleges.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">
              No colleges yet. Create the first one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">College</th>
                    <th className="text-left px-4 py-3 font-medium">Plan</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Subscription End</th>
                    <th className="text-left px-4 py-3 font-medium">Users</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {colleges.map((college) => {
                    const daysLeft = Math.ceil((new Date(college.subscriptionEnd) - new Date()) / 86400000);
                    const isLoading = actionLoading === college.id;
                    const isDeleted = college.lifecycleStatus === 'soft_deleted';

                    return (
                      <tr key={college.id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className={`font-medium ${LIFECYCLE_COLORS[college.lifecycleStatus]}`}>
                            {college.name}
                          </p>
                          <p className="text-xs text-gray-500">{college.code}</p>
                          <p className="text-xs text-gray-600">{college.contactEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="capitalize text-gray-300">{college.subscriptionPlan}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[college.subscriptionStatus] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
                            {college.subscriptionStatus}
                          </span>
                          {isDeleted && (
                            <span className="ml-1 text-xs px-2 py-0.5 rounded-full border bg-red-900/20 text-red-400 border-red-800">
                              deleted
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-gray-300">
                            {new Date(college.subscriptionEnd).toLocaleDateString('en-IN')}
                          </p>
                          <p className={`text-xs ${daysLeft <= 0 ? 'text-red-400' : daysLeft <= 30 ? 'text-yellow-400' : 'text-gray-500'}`}>
                            {daysLeft <= 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {college._count?.users ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {!isDeleted && (
                              <>
                                <button
                                  onClick={() => setEditTarget(college)}
                                  disabled={isLoading}
                                  className="text-xs text-gray-300 hover:text-white disabled:opacity-40 transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => setRenewTarget(college)}
                                  disabled={isLoading}
                                  className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-40 transition-colors"
                                >
                                  Renew
                                </button>
                                {college.subscriptionStatus !== 'suspended' ? (
                                  <button
                                    onClick={() => handleSuspend(college)}
                                    disabled={isLoading}
                                    className="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-40 transition-colors"
                                  >
                                    Suspend
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleReactivate(college)}
                                    disabled={isLoading}
                                    className="text-xs text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors"
                                  >
                                    Reactivate
                                  </button>
                                )}
                                <button
                                  onClick={() => handleSoftDelete(college)}
                                  disabled={isLoading}
                                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {isDeleted && (
                              <>
                                <button
                                  onClick={() => handleReactivate(college)}
                                  disabled={isLoading}
                                  className="text-xs text-green-400 hover:text-green-300 disabled:opacity-40 transition-colors"
                                >
                                  Restore
                                </button>
                                <button
                                  onClick={() => setPurgeTarget(college)}
                                  disabled={isLoading}
                                  className="text-xs text-red-600 hover:text-red-500 disabled:opacity-40 transition-colors font-semibold"
                                >
                                  Purge
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showCreate && (
        <CreateCollegeModal onClose={() => setShowCreate(false)} onSubmit={handleCreate} />
      )}
      {editTarget && (
        <EditCollegeModal college={editTarget} onClose={() => setEditTarget(null)} onSubmit={handleEdit} />
      )}
      {renewTarget && (
        <RenewModal college={renewTarget} onClose={() => setRenewTarget(null)} onSubmit={handleRenew} />
      )}
      {purgeTarget && (
        <PurgeModal college={purgeTarget} onClose={() => setPurgeTarget(null)} onSubmit={handlePurge} />
      )}
    </div>
  );
}