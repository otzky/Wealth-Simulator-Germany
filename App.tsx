import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { DEFAULT_CONFIG } from './constants';
import { SimulationConfig } from './types';
import { runSimulation } from './services/finance';
import SimulationForm from './components/SimulationForm';
import Dashboard from './components/Dashboard';
import { Calculator, Download, FileImage, FileText } from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [results, setResults] = useState(() => runSimulation(DEFAULT_CONFIG));

  // Re-run simulation whenever config changes
  useEffect(() => {
    const res = runSimulation(config);
    setResults(res);
  }, [config]);

  const handleExport = async (type: 'pdf' | 'png') => {
    const element = document.getElementById('root'); // Capture the whole app
    if (!element) return;

    // Create a clone to modify styles for capture
    const clone = element.cloneNode(true) as HTMLElement;
    
    // Modify clone styles to ensure full capture
    clone.style.width = '1280px'; // Force desktop width
    clone.style.height = 'auto';
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    clone.style.background = '#f8fafc'; // Match body bg
    
    // Fix Header
    const header = clone.querySelector('header');
    if (header) {
      header.style.position = 'static'; // Remove sticky
    }

    // Fix Sidebar
    // The sidebar container has classes: "sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto"
    // We need to target it. It's the div inside 'aside'.
    const sidebarContainer = clone.querySelector('aside > div') as HTMLElement;
    if (sidebarContainer) {
      sidebarContainer.style.position = 'static';
      sidebarContainer.style.maxHeight = 'none';
      sidebarContainer.style.overflow = 'visible';
    }

    // Append to body to render
    document.body.appendChild(clone);

    try {
      // Wait a bit for render (though usually synchronous for clone, images might need load but they are already loaded in main)
      const canvas = await html2canvas(clone, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        windowWidth: 1280
      });

      if (type === 'png') {
        const link = document.createElement('a');
        link.download = 'vermoegens-simulation.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else {
        const imgData = canvas.toDataURL('image/png');
        // Calculate PDF size based on image aspect ratio
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        
        // Use A4 Landscape as base, but adjust height if content is long
        // A4 Landscape: 297mm x 210mm
        // Let's use custom size matching the image aspect ratio to avoid cutting/scaling weirdly
        // Convert px to pt or mm? jsPDF default is mm.
        // Let's just map 1px = 0.264583 mm (approx) or just use 'px' unit in jsPDF
        
        const pdf = new jsPDF({
          orientation: imgWidth > imgHeight ? 'l' : 'p',
          unit: 'px',
          format: [imgWidth, imgHeight]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save('vermoegens-simulation.pdf');
      }
    } catch (err) {
      console.error("Export failed", err);
      alert("Export fehlgeschlagen. Bitte versuchen Sie es erneut.");
    } finally {
      document.body.removeChild(clone);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Calculator size={24} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-emerald-600">
              Vermögens-Simulator
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-2">
              <button 
                onClick={() => handleExport('png')}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                title="Als PNG speichern"
              >
                <FileImage size={16} />
                <span>PNG</span>
              </button>
              <button 
                onClick={() => handleExport('pdf')}
                className="flex items-center space-x-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                title="Als PDF speichern"
              >
                <FileText size={16} />
                <span>PDF</span>
              </button>
            </div>
            <div className="text-xs text-slate-400 hidden lg:block border-l pl-4 ml-2">
              React / TypeScript Edition
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar (Input) */}
          <aside className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">Einstellungen</h2>
              <SimulationForm config={config} onChange={setConfig} />
            </div>
          </aside>

          {/* Main Dashboard (Output) */}
          <section className="flex-1 min-w-0">
            <Dashboard results={results} config={config} />
          </section>

        </div>
      </main>
      
      <footer className="bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          &copy; {new Date().getFullYear()} Finanz-Simulationstool. Keine Anlageberatung.
        </div>
      </footer>
    </div>
  );
};

export default App;