import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Generic data table.
 * columns: [{ key, header, render?, className? }]
 */
export const Table = ({ columns, data = [], isLoading, emptyTitle, emptyDescription }) => {
  if (isLoading) {
    return <LoadingSpinner className="py-16" />;
  }

  if (!data.length) {
    return <EmptyState title={emptyTitle || 'No records found'} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {data.map((row, i) => (
            <tr key={row._id || i} className="hover:bg-gray-50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className || ''}`}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};