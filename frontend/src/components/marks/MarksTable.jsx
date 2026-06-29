// components/marks/MarksTable.jsx
import { formatMarks } from '../../utils/gradeCalculator';

export const MarksTable = ({ students = [], subFieldConfig = null, onChange, readOnly = false }) => {
  const hasSubFields = subFieldConfig?.sub_fields?.length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-40">Enrollment</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
            {hasSubFields
              ? subFieldConfig.sub_fields.map((sf) => (
                  <th key={sf._id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                    {sf.name} <span className="text-gray-400">/{sf.max_marks}</span>
                  </th>
                ))
              : <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marks</th>
            }
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
            {!readOnly && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {students.map((s) => (
            <MarksRow
              key={s._id}
              student={s}
              subFields={hasSubFields ? subFieldConfig.sub_fields : null}
              readOnly={readOnly}
              onChange={onChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

const MarksRow = ({ student, subFields, readOnly, onChange }) => {
  const existing = student.marks;

  const handleChange = (fieldId, value) => {
    onChange?.(student._id, fieldId, value);
  };

  const total = existing?.total_marks ?? '';

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 text-gray-500 text-xs">{student.enrollment_number}</td>
      <td className="px-4 py-2 font-medium">{student.name}</td>
      {subFields
        ? subFields.map((sf) => {
            const entry = existing?.sub_field_entries?.find((e) => e.sub_field_id?.toString() === sf._id?.toString());
            return (
              <td key={sf._id} className="px-4 py-2">
                {readOnly ? (
                  <span>{entry?.marks_obtained ?? '—'}</span>
                ) : (
                  <input
                    type="number"
                    min="0"
                    max={sf.max_marks}
                    className="input w-20"
                    defaultValue={entry?.marks_obtained ?? ''}
                    onChange={(e) => handleChange(sf._id, e.target.value)}
                  />
                )}
              </td>
            );
          })
        : (
          <td className="px-4 py-2">
            {readOnly ? (
              <span>{existing?.total_marks ?? '—'}</span>
            ) : (
              <input
                type="number"
                min="0"
                className="input w-24"
                defaultValue={existing?.total_marks ?? ''}
                onChange={(e) => handleChange('total', e.target.value)}
              />
            )}
          </td>
        )
      }
      <td className="px-4 py-2 font-semibold text-gray-800">
        {total !== '' ? `${total}` : '—'}
      </td>
      {!readOnly && (
        <td className="px-4 py-2">
          {existing?.locked && <span className="badge bg-orange-100 text-orange-700">Locked</span>}
        </td>
      )}
    </tr>
  );
};