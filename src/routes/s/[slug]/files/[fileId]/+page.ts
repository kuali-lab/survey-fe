import { env } from '$env/dynamic/public';
import { error } from '@sveltejs/kit';

export async function load({ params, fetch }) {
	const backendUrl = env.PUBLIC_API_URL || 'https://api.logika-teta.web.id';
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
