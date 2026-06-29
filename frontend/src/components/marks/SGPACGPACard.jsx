import { SGPALineChart } from '../common/Charts';
import { getGradeLetter } from '../../utils/gradeCalculator';

export const SGPACGPACard = ({ sgpa, cgpa, semesters = [], components = [] }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {/* SGPA Card */}
    <div className="card p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Current SGPA</p>
      <div className="flex items-end gap-3">
        <span className="text-4xl font-bold text-primary-700">{sgpa ?? '—'}</span>
        <span className="text-lg text-gray-400 mb-1">/ 10</span>
        {sgpa && <span className="badge bg-primary-50 text-primary-700 mb-1">{getGradeLetter((sgpa / 10) * 100)}</span>}
      </div>
      {components.length > 0 && (
        <div className="mt-4 space-y-1">
          {components.map((c, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-600">
              <span>{c.component_name}</span>
              <span>{c.obtained}/{c.max_marks}</span>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* CGPA Card */}
    <div className="card p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Overall CGPA</p>
      <div className="flex items-end gap-3">
        <span className="text-4xl font-bold text-green-700">{cgpa ?? '—'}</span>
        <span className="text-lg text-gray-400 mb-1">/ 10</span>
        {cgpa && <span className="badge bg-green-50 text-green-700 mb-1">{getGradeLetter((cgpa / 10) * 100)}</span>}
      </div>
      {semesters.length > 1 && (
        <div className="mt-4">
          <SGPALineChart data={semesters} />
        </div>
      )}
    </div>
  </div>
);