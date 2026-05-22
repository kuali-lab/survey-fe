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
	<title>Preview File - Logika Teta</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
	<div class="bg-white rounded-xl shadow-sm border border-gray-200 max-w-3xl w-full overflow-hidden flex flex-col">
		
		<!-- Header -->
		<div class="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
			<div class="p-2 bg-blue-50 text-blue-600 rounded-lg">
				{#if isImage}
					<ImageIcon size={20} />
				{:else if isVideo}
					<VideoIcon size={20} />
				{:else if isAudio}
					<AudioLinesIcon size={20} />
				{:else if isPdf}
					<FileTextIcon size={20} />
				{:else}
					<FileIcon size={20} />
				{/if}
			</div>
			<div class="flex-1 min-w-0">
				<h2 class="text-sm font-semibold text-gray-900 truncate" title={meta.name}>{meta.name}</h2>
				<p class="text-xs text-gray-500">{formatSize(meta.size)} • {meta.type}</p>
			</div>
			<a 
				href={downloadUrl} 
				class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
			>
				<DownloadIcon size={16} />
				<span class="hidden sm:inline">Download</span>
			</a>
		</div>

		<!-- Preview Area -->
		<div class="flex-1 min-h-[300px] max-h-[70vh] bg-gray-100 flex items-center justify-center overflow-auto p-4">
			{#if isImage}
				<img 
					src={rawUrl} 
					alt={meta.name} 
					class="max-w-full max-h-[60vh] object-contain rounded border border-gray-200 shadow-sm bg-white" 
				/>
			{:else if isVideo}
				<!-- svelte-ignore a11y-media-has-caption -->
				<video 
					src={rawUrl} 
					controls 
					class="max-w-full max-h-[60vh] rounded border border-gray-200 shadow-sm bg-black"
				></video>
			{:else if isAudio}
				<div class="w-full max-w-md bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-4">
					<div class="p-4 bg-gray-50 rounded-full text-gray-400">
						<AudioLinesIcon size={48} />
					</div>
					<audio src={rawUrl} controls class="w-full"></audio>
				</div>
			{:else if isPdf}
				<object 
					title="PDF Document Preview"
					data={rawUrl} 
					type="application/pdf" 
					class="w-full h-[60vh] rounded border border-gray-200 shadow-sm bg-white"
				>
					<div class="flex flex-col items-center gap-2 text-gray-500 py-10">
						<AlertCircle size={32} />
						<p>Browser tidak mendukung preview PDF.</p>
						<a href={downloadUrl} class="text-blue-600 hover:underline">Download PDF</a>
					</div>
				</object>
			{:else}
				<div class="flex flex-col items-center gap-3 text-gray-400 py-12">
					<FileIcon size={64} strokeWidth={1} />
					<p class="text-sm text-gray-500">Preview tidak tersedia untuk format ini.</p>
				</div>
			{/if}
		</div>
	</div>
</div>
