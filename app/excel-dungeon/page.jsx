import PageShell from '@/components/PageShell.jsx';
import Markup from '@/games/excel-dungeon/Markup.jsx';
import '@/games/excel-dungeon/style.css';

export const metadata = { title: 'Excel Dungeon · WNI' };

export default function ExcelDungeonPage() {
  return (
    <PageShell page="excel-dungeon">
      <Markup />
    </PageShell>
  );
}
