import Sidebar from './Sidebar.jsx';
import StatusModal from './StatusModal.jsx';
import TopologyCanvas from './TopologyCanvas.jsx';

export default function MapaPage() {
  return (
    <>
      <main className="relative min-w-0 flex-1">
        <TopologyCanvas />
      </main>
      <Sidebar />
      <StatusModal />
    </>
  );
}
