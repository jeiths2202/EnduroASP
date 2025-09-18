import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if F3 key is currently fixed
    const main001Path = '/home/aspuser/app/volume/DISK01/JAVA/MAIN001.java';
    const main001Content = fs.readFileSync(main001Path, 'utf8');
    
    const isFixed = main001Content.includes('returnToLogo();') && 
                   !main001Content.includes('triggerAbendOnF3();');
    
    // Check for recent backup files (indicating recent fixes)
    const backupDir = '/home/aspuser/app/volume/DISK01/JAVA/backups';
    let hasRecentBackup = false;
    
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      const recentFiles = files.filter(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        const fileTime = stats.mtime.getTime();
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        return fileTime > fiveMinutesAgo;
      });
      hasRecentBackup = recentFiles.length > 0;
    }
    
    // Check DevOps fix log
    const logPath = '/home/aspuser/app/logs/devops-fix.log';
    let hasRecentLogEntry = false;
    
    if (fs.existsSync(logPath)) {
      try {
        const { stdout } = await execAsync(`tail -1 ${logPath}`);
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        const logTime = new Date(stdout.substring(1, 20)).getTime();
        hasRecentLogEntry = logTime > fiveMinutesAgo;
      } catch (error) {
        console.warn('Failed to check log file:', error);
      }
    }
    
    res.status(200).json({
      hasRecentFix: isFixed && (hasRecentBackup || hasRecentLogEntry),
      isCurrentlyFixed: isFixed,
      hasRecentBackup,
      hasRecentLogEntry,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to check recent fix:', error);
    res.status(500).json({
      error: 'Failed to check recent fix status',
      hasRecentFix: false
    });
  }
}