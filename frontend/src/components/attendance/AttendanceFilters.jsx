// components/attendance/AttendanceFilters.jsx
export const AttendanceFilters = ({ filters, onChange, branches = [], subjects = [] }) => (
    <div className="card p-4 mb-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {branches.length > 0 && (
          <div>
            <label className="label">Branch</label>
            <select className="input" value={filters.branch_id || ''} onChange={(e) => onChange({ ...filters, branch_id: e.target.value })}>
              <option value="">All Branches</option>
              {branches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>
        )}
        {subjects.length > 0 && (
          <div>
            <label className="label">Subject</label>
            <select className="input" value={filters.subject_id || ''} onChange={(e) => onChange({ ...filters, subject_id: e.target.value })}>
              <option value="">All Subjects</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Year</label>
          <select className="input" value={filters.year || ''} onChange={(e) => onChange({ ...filters, year: e.target.value })}>
            <option value="">All Years</option>
            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
          </select>
        </div>
      </div>
    </div>
  );