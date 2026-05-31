<script>
  import '../app.css'
  import { env } from '$env/dynamic/public'
  let { children } = $props()

  // OG/Twitter image needs an absolute URL (crawlers). Built from PUBLIC_SITE_URL
  // so the domain is env-driven, not hardcoded. Dynamic env = safe when unset.
  const ogImage = `${(env.PUBLIC_SITE_URL || '').replace(/\/+$/, '')}/logo-logika-teta.png`
</script>

<svelte:head>
  <meta property="og:image" content={ogImage} />
  <meta name="twitter:image" content={ogImage} />
</svelte:head>

{@render children()}
