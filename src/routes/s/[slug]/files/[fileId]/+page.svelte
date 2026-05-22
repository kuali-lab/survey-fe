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
</script>

<svelte:head>
	<title>{meta.name} - Logika Statistik</title>
</svelte:head>

<div class="h-screen w-full flex flex-col bg-[#0f111a] text-gray-200 overflow-hidden font-sans">
	
	<!-- Top Navbar -->
	<header class="h-16 shrink-0 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-4 sm:px-6 z-10 text-gray-900">
		<div class="flex items-center gap-4">
			<a href="/" class="hover:opacity-80 transition-opacity">
				<Logo class="h-8" />
			</a>
		</div>

		<div class="hidden md:flex flex-col items-center flex-1 mx-4 max-w-xl">
			<h1 class="text-sm font-semibold truncate w-full text-center" title={meta.name}>{meta.name}</h1>
			<p class="text-xs text-gray-500">{formatSize(meta.size)} • {meta.type}</p>
		</div>

		<div class="flex items-center gap-3">
			<a 
				href={downloadUrl} 
				class="inline-flex items-center gap-2 px-4 py-2 bg-[#f4b41a] hover:bg-[#dca012] text-white text-sm font-semibold rounded-full transition-colors shadow-sm"
			>
				<DownloadIcon size={16} strokeWidth={2.5} />
				<span class="hidden sm:inline">Download</span>
			</a>
		</div>
	</header>

	<!-- Mobile Info Bar (Visible only on small screens) -->
	<div class="md:hidden shrink-0 bg-[#161925] border-b border-white/5 p-3 flex flex-col items-center justify-center text-center">
		<h1 class="text-sm font-medium truncate w-full px-4" title={meta.name}>{meta.name}</h1>
		<p class="text-xs text-gray-400 mt-0.5">{formatSize(meta.size)}</p>
	</div>

	<!-- Main Preview Area -->
	<main class="flex-1 overflow-hidden relative flex items-center justify-center p-4 sm:p-8 bg-[#0f111a] backdrop-blur-sm">
		{#if isImage}
			<img 
				src={rawUrl} 
				alt={meta.name} 
				class="max-w-full max-h-full object-contain rounded drop-shadow-2xl select-none" 
				draggable="false"
			/>
		{:else if isVideo}
			<!-- svelte-ignore a11y-media-has-caption -->
			<video 
				src={rawUrl} 
				controls 
				class="max-w-full max-h-full rounded-lg shadow-2xl bg-black outline-none ring-1 ring-white/10"
			></video>
		{:else if isAudio}
			<div class="w-full max-w-md bg-[#161925] p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-6 ring-1 ring-white/10">
				<div class="w-24 h-24 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-400">
					<AudioLinesIcon size={48} strokeWidth={1.5} />
				</div>
				<div class="text-center w-full">
					<h3 class="font-medium text-gray-100 truncate w-full mb-1">{meta.name}</h3>
					<p class="text-sm text-gray-400 mb-6">{formatSize(meta.size)}</p>
					<audio src={rawUrl} controls class="w-full custom-audio"></audio>
				</div>
			</div>
		{:else if isPdf}
			<div class="w-full h-full max-w-5xl rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-white flex flex-col">
				<object 
					title="PDF Document Preview"
					data={rawUrl} 
					type="application/pdf" 
					class="w-full flex-1"
				>
					<div class="flex flex-col items-center justify-center h-full gap-4 text-gray-500 bg-gray-50">
						<AlertCircle size={48} class="text-gray-400" />
						<p class="text-lg font-medium text-gray-700">Preview PDF tidak didukung di browser ini.</p>
						<p class="text-sm text-gray-500 mb-4">Silakan download file untuk membacanya.</p>
						<a 
							href={downloadUrl} 
							class="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-medium transition-colors"
						>
							Download PDF
						</a>
					</div>
				</object>
			</div>
		{:else}
			<div class="flex flex-col items-center gap-5 text-gray-300 py-12 px-8 bg-[#161925] rounded-2xl ring-1 ring-white/5 shadow-2xl max-w-sm text-center">
				<div class="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center">
					<FileIcon size={40} strokeWidth={1.5} class="text-gray-400" />
				</div>
				<div>
					<h3 class="font-medium text-gray-100 mb-2 truncate max-w-[250px]">{meta.name}</h3>
					<p class="text-sm text-gray-400 mb-6">Preview tidak tersedia untuk tipe file ini ({meta.type || 'Unknown'}).</p>
					<a 
						href={downloadUrl} 
						class="inline-flex items-center justify-center w-full px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-medium transition-colors"
					>
						Download File
					</a>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	/* Make default audio player look a bit better in dark mode context */
	.custom-audio {
		border-radius: 999px;
		background: #f1f3f5;
	}
	.custom-audio::-webkit-media-controls-panel {
		background-color: #f1f3f5;
	}
</style>
