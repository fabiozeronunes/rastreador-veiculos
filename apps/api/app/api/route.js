export async function GET(request) {
  // Dinamic import para evitar ERR_UNKNOWN_BUILTIN_MODULE no build
  const { exec } = await import('node:child');
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET || 'change-me';
  if (key !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Sync FIPE
  exec('node packages/fipe/src/sync.js', (err, stdout, stderr) => {
    console.log('FIPE sync:', stdout, stderr);
  });
  return new Response('FIPE sync initiated');
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET || 'change-me';
  if (key !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Run one scrape cycle
  const { exec } = await import('node:child');
  exec('node packages/worker/src/index.js --once', (err, stdout, stderr) => {
    console.log('Scrape run:', stdout, stderr);
  });
  return new Response('Scrape cycle initiated');
}