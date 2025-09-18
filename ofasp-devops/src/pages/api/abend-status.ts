import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Execute ABEND check script
    const { stdout, stderr } = await execAsync('python3 /home/aspuser/app/monitoring/scripts/check_abend.py --json');
    
    if (stderr) {
      console.warn('ABEND check stderr:', stderr);
    }

    // Parse the JSON output
    const abendData = JSON.parse(stdout);
    
    // Also get total historical count from log file
    let totalCount = 0;
    try {
      const abendLogPath = '/home/aspuser/app/logs/abend.log';
      if (fs.existsSync(abendLogPath)) {
        const logContent = fs.readFileSync(abendLogPath, 'utf8');
        const logLines = logContent.trim().split('\n').filter(line => line.trim().length > 0);
        const abendEntries = logLines.filter(line => line.includes('ABEND CEE3204S'));
        totalCount = abendEntries.length;
      }
    } catch (logError) {
      console.warn('Failed to read ABEND log:', logError);
    }
    
    // Return structured response with total count
    res.status(200).json({
      count: abendData.abend_count || 0,
      status: abendData.status || 'unknown',
      timestamp: abendData.check_timestamp || new Date().toISOString(),
      latest: abendData.abends && abendData.abends.length > 0 ? abendData.abends[0] : null,
      totalCount: totalCount
    });
    
  } catch (error) {
    console.error('Failed to fetch ABEND status:', error);
    res.status(500).json({
      error: 'Failed to fetch ABEND status',
      count: 0,
      status: 'error',
      totalCount: 0
    });
  }
}