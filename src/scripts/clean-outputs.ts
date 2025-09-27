import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

async function cleanFile(filePath: string) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed || !Array.isArray(parsed.companies)) return;

    const originalCount = parsed.companies.length;
    const filtered = parsed.companies.filter((c: any) => c && c.companyName && c.companyName !== 'N/A' && c.isExist !== '0' && !c.error);
    const cleaned = { ...parsed, companies: filtered, totalCompanies: filtered.length };

    // Backup
    const backupPath = `${filePath}.bak`;
    await fs.copyFile(filePath, backupPath);

    await fs.writeFile(filePath, JSON.stringify(cleaned, null, 2), 'utf8');
    console.log(`Cleaned ${path.basename(filePath)}: ${originalCount} -> ${filtered.length} (backup: ${path.basename(backupPath)})`);
  } catch (error) {
    console.warn(`Skipped ${path.basename(filePath)} (error):`, (error as Error).message);
  }
}

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const workspaceRoot = path.resolve(__dirname, '../../');
  const targets = [
    path.join(workspaceRoot, 'output'),
    path.join(workspaceRoot, 'public', 'output')
  ];

  for (const dir of targets) {
    try {
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (f.endsWith('.json')) {
          await cleanFile(path.join(dir, f));
        }
      }
    } catch (error) {
      console.warn(`Cannot access ${dir}:`, (error as Error).message);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
