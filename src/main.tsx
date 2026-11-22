import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import BuyRentApp from './buyrent/BuyRentApp';
import { MODULES, type ModuleId } from './components/Chrome';
import './index.css';

/** Which module the address points to: /kaufen-mieten or the wealth simulator. */
function moduleFromPath(): ModuleId {
  return window.location.pathname.replace(/\/+$/, '') === '/kaufen-mieten' ? 'buyrent' : 'wealth';
}

function Root() {
  const [module, setModule] = useState<ModuleId>(moduleFromPath);
  useEffect(() => {
    const onPop = () => setModule(moduleFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    document.title = MODULES.find((m) => m.id === module)!.title;
  }, [module]);
  const switchTo = (id: ModuleId) => {
    history.pushState(null, '', MODULES.find((m) => m.id === id)!.path);
    setModule(id);
    window.scrollTo(0, 0);
  };
  return module === 'buyrent' ? <BuyRentApp onSwitchModule={switchTo} /> : <App onSwitchModule={switchTo} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
