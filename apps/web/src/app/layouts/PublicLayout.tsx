import { Outlet } from 'react-router-dom';
import { Navbar } from '../../components/navigation/Navbar';
import { Footer } from '../../components/navigation/Footer';

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-text" style={{ backgroundColor: 'var(--bg)' }}>
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
