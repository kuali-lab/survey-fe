<script lang="ts">
	import { 
		FileIcon, 
		DownloadIcon, 
		ImageIcon, 
		FileTextIcon, 
		VideoIcon, 
		AudioLinesIcon,
		AlertCircle
	} from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	
	export let data;
	
	$: ({ slug, fileId, meta, backendUrl } = data);
	
	$: rawUrl = `${backendUrl}/api/v1/s/${slug}/files/${fileId}?action=raw`;
	$: downloadUrl = `${backendUrl}/api/v1/s/${slug}/files/${fileId}?action=download`;
	
	function formatSize(bytes: number) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
	
	$: isImage = meta.type.startsWith('image/');
	$: isVideo = meta.type.startsWith('video/');
	$: isAudio = meta.type.startsWith('audio/');
	$: isPdf = meta.type === 'application/pdf';

	let iconError = false;

	$: fileExtension = meta.name.split('.').pop()?.toUpperCase() || 'UNKNOWN';
	
	$: fileTypeInfo = (() => {
		if (isImage) return { label: 'Gambar', icon: 'image', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' };
		if (isVideo) return { label: 'Video', icon: 'video', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
		if (isAudio) return { label: 'Audio', icon: 'audio', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.1)' };
		if (isPdf) return { label: 'PDF', icon: 'pdf', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.1)' };
		
		const type = (meta.type || '').toLowerCase();
		const ext = fileExtension.toLowerCase();
		
		if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv') || ['xlsx', 'xls', 'csv'].includes(ext)) {
			return { label: 'Spreadsheet', icon: 'spreadsheet', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.1)' };
		}
		if (type.includes('word') || type.includes('document') || ['doc', 'docx'].includes(ext)) {
			return { label: 'Dokumen', icon: 'document', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.1)' };
		}
		if (type.includes('presentation') || type.includes('powerpoint') || ['ppt', 'pptx'].includes(ext)) {
			return { label: 'Presentasi', icon: 'presentation', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.1)' };
		}
		if (type.includes('zip') || type.includes('compressed') || type.includes('tar') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
			return { label: 'Arsip', icon: 'archive', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.1)' };
		}
		if (type.includes('json') || type.includes('javascript') || type.includes('html') || type.includes('css')) {
			return { label: 'Kode', icon: 'code', color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.1)' };
		}
		return { label: 'File Lainnya', icon: 'unknown', color: '#8c8f93', bgColor: '#1f2937' };
	})();
</script>

<svelte:head>
	<title>{meta.name} - Logika Statistik</title>
</svelte:head>

<div class="layout-container">
	<!-- Top Navbar -->
	<header class="navbar">
		<div class="nav-left">
			<a href="/" class="logo-link">
				<div class="logo-wrapper">
					<Logo />
				</div>
			</a>
		</div>

		<div class="nav-center">
			<h1 class="file-name" title={meta.name}>{meta.name}</h1>
			<p class="file-meta">{formatSize(meta.size)} • {meta.type}</p>
		</div>

		<div class="nav-right">
			<a href={downloadUrl} class="btn-download">
				<DownloadIcon size={16} strokeWidth={2.5} />
				<span class="btn-text">Download</span>
			</a>
		</div>
	</header>

	<!-- Mobile Info Bar (Visible only on small screens) -->
	<div class="mobile-info-bar">
		<h1 class="mobile-file-name" title={meta.name}>{meta.name}</h1>
		<p class="mobile-file-meta">{formatSize(meta.size)}</p>
	</div>

	<!-- Main Preview Area -->
	<main class="preview-area">
		{#if isImage}
			<div class="patreon-card">
				<div class="patreon-image-wrapper">
					<img 
						src={rawUrl} 
						alt="" 
						class="ambient-bg" 
						aria-hidden="true"
					/>
					<img 
						src={rawUrl} 
						alt={meta.name} 
						class="patreon-image" 
						draggable="false"
					/>
				</div>
				<div class="patreon-content">
					<h2 class="patreon-title">{meta.name}</h2>
					<div class="meta-badges">
						<span class="badge file-ext-badge" style="background-color: {fileTypeInfo.bgColor}; color: {fileTypeInfo.color}; border: 1px solid {fileTypeInfo.color}40;">
							.{fileExtension}
						</span>
						<span class="badge size-badge">{formatSize(meta.size)}</span>
						<span class="badge type-badge">{fileTypeInfo.label}</span>
					</div>
				</div>
			</div>
		{:else if isVideo}
			<div class="patreon-card">
				<div class="patreon-image-wrapper bg-black">
					<!-- svelte-ignore a11y-media-has-caption -->
					<video 
						src={rawUrl} 
						controls 
						class="patreon-video"
					></video>
				</div>
				<div class="patreon-content">
					<h2 class="patreon-title">{meta.name}</h2>
					<div class="meta-badges">
						<span class="badge file-ext-badge" style="background-color: {fileTypeInfo.bgColor}; color: {fileTypeInfo.color}; border: 1px solid {fileTypeInfo.color}40;">
							.{fileExtension}
						</span>
						<span class="badge size-badge">{formatSize(meta.size)}</span>
						<span class="badge type-badge">{fileTypeInfo.label}</span>
					</div>
				</div>
			</div>
		{:else if isAudio}
			<div class="audio-card">
				<div class="audio-icon-wrapper">
					<AudioLinesIcon size={48} strokeWidth={1.5} />
				</div>
				<div class="audio-info">
					<h3 class="audio-title">{meta.name}</h3>
					<div class="meta-badges" style="justify-content: center; margin-bottom: 24px;">
						<span class="badge file-ext-badge" style="background-color: {fileTypeInfo.bgColor}; color: {fileTypeInfo.color}; border: 1px solid {fileTypeInfo.color}40;">
							.{fileExtension}
						</span>
						<span class="badge size-badge">{formatSize(meta.size)}</span>
						<span class="badge type-badge">{fileTypeInfo.label}</span>
					</div>
					<audio src={rawUrl} controls class="custom-audio"></audio>
				</div>
			</div>
		{:else if isPdf}
			<div class="pdf-container">
				<object 
					title="PDF Document Preview"
					data={rawUrl} 
					type="application/pdf" 
					class="pdf-object"
				>
					<div class="pdf-fallback">
						<AlertCircle size={48} class="alert-icon" />
						<p class="pdf-fallback-title">Preview PDF tidak didukung di browser ini.</p>
						<p class="pdf-fallback-desc">Silakan download file untuk membacanya.</p>
						<a href={downloadUrl} class="btn-download-pdf">
							Download PDF
						</a>
					</div>
				</object>
			</div>
		{:else}
			<div class="unknown-card">
				<div class="unknown-icon-wrapper" style="background-color: {fileTypeInfo.bgColor};">
					{#if !iconError}
						<img 
							src="/icons/filetypes/{fileTypeInfo.icon}.svg" 
							alt="{fileTypeInfo.label}" 
							class="filetype-icon" 
							on:error={() => iconError = true} 
						/>
					{:else}
						<FileIcon size={40} strokeWidth={1.5} color={fileTypeInfo.color} />
					{/if}
				</div>
				<div class="unknown-info">
					<h3 class="unknown-title">{meta.name}</h3>
					<div class="meta-badges" style="justify-content: center; margin-bottom: 24px;">
						<span class="badge file-ext-badge" style="background-color: {fileTypeInfo.bgColor}; color: {fileTypeInfo.color}; border: 1px solid {fileTypeInfo.color}40;">
							.{fileExtension}
						</span>
						<span class="badge size-badge">{formatSize(meta.size)}</span>
						<span class="badge type-badge">{fileTypeInfo.label}</span>
					</div>
					<p class="unknown-meta">Preview visual tidak tersedia untuk format file ini.</p>
					<a href={downloadUrl} class="btn-download-unknown">
						Download File
					</a>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	/* Layout Base */
	.layout-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		width: 100vw;
		background-color: #0f111a;
		color: #e2e8f0;
		font-family: var(--font, sans-serif);
		overflow: hidden;
	}

	/* Navbar */
	.navbar {
		flex-shrink: 0;
		height: 64px;
		background-color: #ffffff;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		color: #111827;
		z-index: 10;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.nav-left {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.logo-link {
		text-decoration: none;
		transition: opacity 0.2s;
	}
	.logo-link:hover {
		opacity: 0.8;
	}

	.logo-wrapper {
		height: 32px;
	}
	.logo-wrapper :global(svg) {
		height: 100%;
		width: auto;
	}

	.nav-center {
		display: none;
		flex-direction: column;
		align-items: center;
		flex: 1;
		margin: 0 16px;
		max-width: 600px;
	}

	.file-name {
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
		text-align: center;
		margin: 0;
	}

	.file-meta {
		font-size: 12px;
		color: #6b7280;
		margin: 0;
	}

	.nav-right {
		display: flex;
		align-items: center;
	}

	.btn-download {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background-color: var(--primary-50, #f4b41a);
		color: #ffffff;
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
		border-radius: 9999px;
		transition: background-color 0.2s;
		box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
	}

	.btn-download:hover {
		background-color: #dca012;
	}

	.btn-text {
		display: none;
	}

	/* Mobile Info Bar */
	.mobile-info-bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		background-color: #161925;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		padding: 12px;
		flex-shrink: 0;
	}

	.mobile-file-name {
		font-size: 14px;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		width: 100%;
		padding: 0 16px;
		margin: 0;
	}

	.mobile-file-meta {
		font-size: 12px;
		color: #9ca3af;
		margin: 4px 0 0;
	}

	/* Preview Area */
	.preview-area {
		flex: 1;
		position: relative;
		overflow-y: auto;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 32px 16px;
		background-color: #0f111a;
	}

	/* Patreon Style Card */
	.patreon-card {
		width: 100%;
		max-width: 760px;
		background-color: #fdfcf7; /* Putih agak kuning / off-white */
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.05);
		display: flex;
		flex-direction: column;
		margin: auto;
	}

	.patreon-image-wrapper {
		width: 100%;
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: #1a1d27; /* Darker base for ambient effect */
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		overflow: hidden;
	}

	.ambient-bg {
		position: absolute;
		top: -10%;
		left: -10%;
		width: 120%;
		height: 120%;
		object-fit: cover;
		filter: blur(50px) saturate(150%);
		opacity: 0.5;
		z-index: 0;
		pointer-events: none;
	}

	.patreon-image-wrapper.bg-black {
		background-color: #000000;
	}

	.patreon-image {
		width: 100%;
		max-height: 70vh;
		object-fit: contain;
		user-select: none;
		z-index: 1;
	}

	.patreon-video {
		width: 100%;
		max-height: 70vh;
		outline: none;
	}

	.patreon-content {
		padding: 24px;
		color: #111827;
	}

	.patreon-title {
		font-size: 20px;
		font-weight: 700;
		margin: 0 0 6px;
		line-height: 1.3;
		word-break: break-word;
	}

	.patreon-meta {
		font-size: 14px;
		color: #4b5563;
		margin: 0;
	}

	/* Audio Card */
	.audio-card {
		width: 100%;
		max-width: 400px;
		background-color: #161925;
		padding: 32px;
		border-radius: 16px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.audio-icon-wrapper {
		width: 96px;
		height: 96px;
		background-color: rgba(59, 130, 246, 0.1);
		color: #60a5fa;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.audio-info {
		text-align: center;
		width: 100%;
	}

	.audio-title {
		font-size: 16px;
		font-weight: 500;
		color: #f3f4f6;
		margin: 0 0 4px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.audio-meta {
		font-size: 14px;
		color: #9ca3af;
		margin: 0 0 24px;
	}

	.custom-audio {
		width: 100%;
		border-radius: 999px;
		background: #f1f3f5;
	}

	.custom-audio::-webkit-media-controls-panel {
		background-color: #f1f3f5;
	}

	/* PDF Container */
	.pdf-container {
		width: 100%;
		height: 100%;
		max-width: 1024px;
		background-color: #ffffff;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
	}

	.pdf-object {
		width: 100%;
		flex: 1;
	}

	.pdf-fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 16px;
		background-color: #f9fafb;
		color: #6b7280;
	}

	.alert-icon {
		color: #9ca3af;
	}

	.pdf-fallback-title {
		font-size: 18px;
		font-weight: 500;
		color: #374151;
		margin: 0;
	}

	.pdf-fallback-desc {
		font-size: 14px;
		margin: 0 0 16px;
	}

	.btn-download-pdf {
		padding: 10px 24px;
		background-color: #2563eb;
		color: #ffffff;
		border-radius: 9999px;
		font-weight: 500;
		text-decoration: none;
		transition: background-color 0.2s;
	}
	.btn-download-pdf:hover {
		background-color: #1d4ed8;
	}

	/* Unknown File Card */
	.unknown-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		padding: 48px 32px;
		background-color: #161925;
		border-radius: 16px;
		border: 1px solid rgba(255, 255, 255, 0.05);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		max-width: 320px;
		text-align: center;
	}

	.unknown-icon-wrapper {
		width: 80px;
		height: 80px;
		background-color: #1f2937;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.filetype-icon {
		width: 48px;
		height: 48px;
		object-fit: contain;
	}

	.unknown-info {
		width: 100%;
	}

	.unknown-title {
		font-weight: 500;
		color: #f3f4f6;
		margin: 0 0 8px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.unknown-meta {
		font-size: 14px;
		color: #9ca3af;
		margin: 0 0 24px;
	}

	/* Badges */
	.meta-badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}

	.badge {
		font-size: 12px;
		font-weight: 600;
		padding: 4px 10px;
		border-radius: 9999px;
		display: inline-flex;
		align-items: center;
	}

	.file-ext-badge {
		letter-spacing: 0.5px;
	}

	.size-badge {
		background-color: #f3f4f6;
		color: #4b5563;
		border: 1px solid #e5e7eb;
	}

	.type-badge {
		background-color: #f3f4f6;
		color: #4b5563;
		border: 1px solid #e5e7eb;
	}
	
	:global(.unknown-card) .size-badge,
	:global(.unknown-card) .type-badge,
	:global(.audio-card) .size-badge,
	:global(.audio-card) .type-badge {
		background-color: rgba(255, 255, 255, 0.05);
		color: #9ca3af;
		border-color: rgba(255, 255, 255, 0.1);
	}

	.btn-download-unknown {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 10px 16px;
		background-color: #ffffff;
		color: #111827;
		border-radius: 12px;
		font-weight: 500;
		text-decoration: none;
		transition: background-color 0.2s;
	}
	.btn-download-unknown:hover {
		background-color: #f3f4f6;
	}

	/* Media Queries */
	@media (min-width: 768px) {
		.nav-center {
			display: flex;
		}
		.mobile-info-bar {
			display: none;
		}
		.btn-text {
			display: inline;
		}
		.preview-area {
			padding: 32px;
		}
	}
</style>
