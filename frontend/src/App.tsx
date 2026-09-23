import { ShortenForm } from './components/ShortenForm';
import { StatsLookup } from './components/StatsLookup';
import './index.css';

export default function App() {
  return (
    <main className="app">
      <h1>URL Shortener</h1>
      <ShortenForm />
      <StatsLookup />
    </main>
  );
}
