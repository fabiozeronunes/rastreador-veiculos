export default async function handler(req, res) {
  // Dinamic import para evitar ERR_UNKNOWN_BUILTIN_MODULE no build
  const { exec } = await import('node:child');
  const searchParams = new URL(req.url).searchParams;
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET || 'change-me';
  if (key !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Sync FIPE
  exec('node packages/fipe/src/sync.js', (err, stdout, stderr) => {
    console.log('FIPE sync:', stdout, stderr);
  });
  res.status(200).json({ status: 'FIPE sync initiated' });
}

export async function POST(req, res) {
  const searchParams = new URL(req.url).searchParams;
  const key = searchParams.get('key');
  const cronSecret = process.env.CRON_SECRET || 'change-me';
  if (key !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  // Run one scrape cycle
  const { exec } = await import('node:child');
  exec('node packages/worker/src/index.js --once', (err, stdout, stderr) => {
    console.log('Scrape run:', stdout, stderr);
  });
  res.status(200).json({ status: 'Scrape cycle initiated' });
}