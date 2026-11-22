export async function GET(request) {
  // Dinamic import para evitar ERR_UNKNOWN_BUILTIN_MODULE no build
  const { exec } = await import('child_process');
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET || 'change-me';
  if (key !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Sync FIPE (caminho relativo à raiz do monorepo)
  exec('node packages/fipe/src/sync.js', { cwd: process.cwd().replace(/\/apps\/api$/, '') }, (err, stdout, stderr) => {
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
  const { exec } = await import('child_process');
  const root = process.cwd().replace(/\/apps\/api$/, '');
  exec('node packages/worker/src/index.cjs --once', { cwd: root }, (err, stdout, stderr) => {
    console.log('Scrape run:', stdout, stderr);
  });
  return new Response('Scrape cycle initiated');
}