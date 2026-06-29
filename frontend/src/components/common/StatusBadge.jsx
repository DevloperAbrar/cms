export const StatusBadge = ({ status }) => {
    const variants = {
      active:     'bg-green-100 text-green-800',
      inactive:   'bg-gray-100 text-gray-700',
      deleted:    'bg-red-100 text-red-700',
      published:  'bg-blue-100 text-blue-800',
      draft:      'bg-yellow-100 text-yellow-800',
      locked:     'bg-orange-100 text-orange-800',
      normal:     'bg-gray-100 text-gray-700',
      important:  'bg-yellow-100 text-yellow-800',
      urgent:     'bg-red-100 text-red-700',
    };
  
    return (
      <span className={`badge ${variants[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };