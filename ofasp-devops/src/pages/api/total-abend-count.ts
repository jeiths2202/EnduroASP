import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const abendLogPath = '/home/aspuser/app/logs/abend.log';
    
    if (!fs.existsSync(abendLogPath)) {
      return res.status(200).json({ totalCount: 0 });
    }

    // Read the ABEND log file and count entries
    const logContent = fs.readFileSync(abendLogPath, 'utf8');
    const logLines = logContent.trim().split('\n').filter(line => line.trim().length > 0);
    
    // Count unique ABEND entries
    const abendEntries = logLines.filter(line => line.includes('ABEND CEE3204S'));
    
    res.status(200).json({
      totalCount: abendEntries.length,
      lastEntry: abendEntries.length > 0 ? abendEntries[abendEntries.length - 1] : null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to count ABEND entries:', error);
    res.status(500).json({
      error: 'Failed to count ABEND entries',
      totalCount: 0
    });
  }
}