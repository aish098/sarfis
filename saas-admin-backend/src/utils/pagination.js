exports.getPagination = (query) => {
  let { page = 1, limit = 25, sort = 'created_at', order = 'desc' } = query;
  
  page = parseInt(page, 10);
  if (isNaN(page) || page < 1) page = 1;

  limit = parseInt(limit, 10);
  if (isNaN(limit) || limit < 1) limit = 25;
  if (limit > 100) limit = 100; // Hard cap limit for API security

  order = String(order).toLowerCase() === 'asc' ? 'asc' : 'desc';

  const offset = (page - 1) * limit;

  return { page, limit, sort, order, offset };
};

exports.formatPaginatedResponse = ({ data, totalItems, page, limit }) => {
  const totalPages = Math.ceil(totalItems / limit) || 1;
  return {
    success: true,
    pagination: {
      total_items: totalItems,
      current_page: page,
      limit,
      total_pages: totalPages,
      has_next_page: page < totalPages,
      has_prev_page: page > 1
    },
    data
  };
};
