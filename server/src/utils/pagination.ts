export const paginate = (page = 1, limit = 20) => ({
  offset: (Math.max(1, page) - 1) * Math.min(limit, 100),
  limit:  Math.min(limit, 100),
});
