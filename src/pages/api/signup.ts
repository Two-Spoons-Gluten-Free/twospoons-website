import type { APIRoute } from 'astro';
import { handleSubmission } from '../../lib/submissions.mjs';

export const prerender = false;
export const POST: APIRoute = ({ request, clientAddress }) => handleSubmission('signup', request, { clientAddress });
