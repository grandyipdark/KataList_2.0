
import React, { Suspense, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KataProvider, useKataContext } from './context/KataContext';
import { AppLayout, ErrorBoundary, NeonWineIcon, SkeletonDashboard, SkeletonListItem, SkeletonDetail, Skeleton, SkeletonChef } from './components/Shared';
import { Dashboard } from './components/Dashboard';
import { TastingList } from './components/TastingList';
import { TastingDetail } from './components/TastingDetail';
import { TastingForm } from './components/TastingForm';
import { CategoriesManager } from './components/CategoriesManager';
import { EauxDeVieChat } from './components/AIViews';

// --- Lazy Load Heavy Components ---
const GuidedTasting = React.lazy(() => import('./components/AIViews').then(module => ({ default: module.GuidedTasting })));
const CompareView = React.lazy(() => import('./components/AIViews').then(module => ({ default: module.CompareView })));
const InsightsView = React.lazy(() => import('./components/InsightsView').then(module => ({ default: module.InsightsView })));
const ProfileView = React.lazy(() => import('./components/ProfileView').then(module => ({ default: module.ProfileView })));
const ChefMode = React.lazy(() => import('./components/ChefMode').then(module => ({ default: module.ChefMode })));
const BlindMode = React.lazy(() => import('./components/BlindMode').then(module => ({ default: module.BlindMode })));
const MergeTool = React.lazy(() => import('./components/MergeTool').then(module => ({ default: module.MergeTool })));
const MapView = React.lazy(() => import('./components/MapView').then(module => ({ default: module.MapView })));
const MixologyView = React.lazy(() => import('./components/MixologyView').then(module => ({ default: module.MixologyView })));

// Smart Skeleton Loader based on Route
const SmartLoader = () => {
    const location = useLocation();
    if (location.pathname === '/') return <SkeletonDashboard />;
    if (location.pathname === '/search') return <div className="p-4 space-y-4">{[...Array(6)].map((_,i) => <SkeletonListItem key={i} />)}</div>;
    if (location.pathname.startsWith('/tasting/')) return <SkeletonDetail />;
    if (location.pathname === '/chef') return <SkeletonChef />;
    if (location.pathname === '/profile') return <div className="p-4 space-y-6"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>;
    
    return (
        <div className="h-full flex flex-col items-center justify-center p-10 animate-fade-in">
            <NeonWineIcon className="w-12 h-12 animate-pulse" />
            <p className="text-slate-500 text-xs mt-4 font-bold">Cargando...</p>
        </div>
    );
};

const AppContent = () => {
    const { isInitializing } = useKataContext();

    if (isInitializing) return (
        <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center">
            <NeonWineIcon className="w-16 h-16 animate-pulse" />
            <p className="text-slate-400 mt-4 font-serif animate-pulse">Iniciando KataList v22.06...</p>
        </div>
    );

    return (
        <AppLayout>
            <Suspense fallback={<SmartLoader />}>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/search" element={<TastingList />} />
                    <Route path="/new" element={<TastingForm />} />
                    <Route path="/edit/:id" element={<TastingForm />} />
                    <Route path="/tasting/:id" element={<TastingDetail />} />
                    <Route path="/categories" element={<CategoriesManager />} />
                    <Route path="/chat" element={<EauxDeVieChat />} />
                    <Route path="/guided" element={<GuidedTasting />} />
                    <Route path="/compare" element={<CompareView />} />
                    <Route path="/insights" element={<InsightsView />} />
                    <Route path="/profile" element={<ProfileView />} />
                    <Route path="/chef" element={<ChefMode />} />
                    <Route path="/blind" element={<BlindMode />} />
                    <Route path="/merge" element={<MergeTool />} />
                    <Route path="/map" element={<MapView />} />
                    <Route path="/mixology" element={<MixologyView />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Suspense>
        </AppLayout>
    );
};

const App = () => {
    return (
        <ErrorBoundary>
            <HashRouter>
                <KataProvider>
                    <AppContent />
                </KataProvider>
            </HashRouter>
        </ErrorBoundary>
    );
};

createRoot(document.getElementById('root')!).render(<App />);
