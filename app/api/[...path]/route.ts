import { errorResponse } from '@/lib/server/errors';

// Unknown /api/* routes get a JSON error code instead of the HTML 404 page.
function notFound() {
  return errorResponse(404, 'NOT_FOUND');
}

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
