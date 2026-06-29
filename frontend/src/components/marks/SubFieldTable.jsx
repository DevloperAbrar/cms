// components/marks/SubFieldTable.jsx
export const SubFieldTable = ({ subFields = [], onChange, readOnly = false }) => (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Sub-field Name</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Max Marks</th>
            {!readOnly && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {subFields.map((sf, i) => (
            <tr key={sf._id || i}>
              <td className="px-4 py-2">
                {readOnly ? sf.name : (
                  <input className="input" value={sf.name} onChange={(e) => onChange(i, 'name', e.target.value)} />
                )}
              </td>
              <td className="px-4 py-2">
                {readOnly ? sf.max_marks : (
                  <input type="number" min="0" className="input w-24" value={sf.max_marks} onChange={(e) => onChange(i, 'max_marks', Number(e.target.value))} />
                )}
              </td>
              {!readOnly && (
                <td className="px-4 py-2">
                  <input type="number" min="0" className="input w-20" value={sf.display_order || 0} onChange={(e) => onChange(i, 'display_order', Number(e.target.value))} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );