import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
	// Derive the API root (without /api/v1) from the single env var the rest of the
	// app uses (PUBLIC_API_BASE_URL includes /api/v1). No hardcoded domain fallback —
	// keeps dev pointing at dev, prod at prod, and follows the domain env.
	const apiBase = (env.PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
	const backendUrl = apiBase.replace(/\/api\/v1$/, '');
	const url = `${backendUrl}/api/v1/s/${params.slug}/files/${params.fileId}?action=meta`;
	
	const res = await fetch(url);
	if (!res.ok) {
		throw error(res.status, 'File tidak ditemukan atau terjadi kesalahan.');
	}
	
	const meta = await res.json();
	return {
		slug: params.slug,
		fileId: params.fileId,
		meta,
		backendUrl
	};
}
