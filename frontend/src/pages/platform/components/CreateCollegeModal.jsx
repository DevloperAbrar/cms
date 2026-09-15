import { useState } from 'react';

export default function CreateCollegeModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: '', code: '', contactEmail: '', contactPhone: '',
    subscriptionPlan: 'standard', durationMonths: 12,
    adminName: '', adminEmail: '', adminPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit({ ...form, durationMonths: Number(form.durationMonths) });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create college');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Create New College</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">College Info</p>

          {[
            { label: 'College Name', field: 'name', placeholder: 'ABC Engineering College', required: true },
            { label: 'College Code (URL slug)', field: 'code', placeholder: 'abc-college', required: true },
            { label: 'Contact Email', field: 'contactEmail', placeholder: 'contact@abc.edu', required: true },
            { label: 'Contact Phone', field: 'contactPhone', placeholder: '+91 9XXXXXXXXX' },
          ].map(({ label, field, placeholder, required }) => (
            <div key={field}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <input
                type={field.includes('Email') ? 'email' : 'text'}
                required={required}
                value={form[field]}
                onChange={handle(field)}
                placeholder={placeholder}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Plan</label>
              <select
                value={form.subscriptionPlan}
                onChange={handle('subscriptionPlan')}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="standard">Standard</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Duration (months)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={form.durationMonths}
                onChange={handle('durationMonths')}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium pt-2">Superadmin Credentials</p>

          {[
            { label: 'Admin Name', field: 'adminName', placeholder: 'Dr. Rajesh Sharma' },
            { label: 'Admin Email', field: 'adminEmail', placeholder: 'admin@abc.edu', required: true },
            { label: 'Admin Password', field: 'adminPassword', placeholder: '••••••••', required: true },
          ].map(({ label, field, placeholder, required }) => (
            <div key={field}>
              <label className="block text-sm text-gray-400 mb-1">{label}</label>
              <input
                type={field === 'adminPassword' ? 'password' : field.includes('Email') ? 'email' : 'text'}
                required={required}
                value={form[field]}
                onChange={handle(field)}
                placeholder={placeholder}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              {loading ? 'Creating...' : 'Create College'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}