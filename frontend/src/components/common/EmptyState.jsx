import { InboxIcon } from 'lucide-react';

export const EmptyState = ({ title = 'No data', description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <InboxIcon className="h-12 w-12 text-gray-300 mb-4" />
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);