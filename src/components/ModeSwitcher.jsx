import { useMode, MODES, LOCALHOST_WINDOW_ID } from '../context/ModeContext';
import {
    DashboardIcon, ChatIcon, EnsembleIcon, CoworkIcon, CodeIcon, NotesIcon, ResearchIcon,
    AgentsIcon, OfficeIcon, BuildIcon, MissionIcon, ProjectsIcon, SurfaceMapIcon, PerciNowIcon, PerciDeskIcon, DocketIcon,
} from './ModeIcons';
import { Globe, Ship, Rocket } from 'lucide-react';

// Duotone palettes for the custom mode icons (see ModeIcons.jsx).
// Secondary is a translucent tint so the primary outline/detail stays
// legible at 17px; the solid accent does the recognising, not the fill.
const ICON_ACTIVE = { '--mi-primary': 'var(--text-primary)', '--mi-secondary': 'color-mix(in srgb, var(--accent) 40%, transparent)', color: 'var(--text-primary)' };
const ICON_RESTING = {
    '--mi-primary': 'var(--accent)',
    '--mi-secondary': 'color-mix(in srgb, var(--accent-cyan) 50%, transparent)',
    color: 'var(--accent)',
};

export default function ModeSwitcher() {
    const { currentMode, setCurrentMode, windows } = useMode();

    const perciNowOpen = windows.some(w => w.id === MODES.PERCI_NOW && w.state !== 'minimized');
    const perciDeskOpen = windows.some(w => w.id === MODES.PERCI_DESK && w.state !== 'minimized');

    const modes = [
        { id: MODES.DASHBOARD, icon: DashboardIcon, label: 'Dashboard' },
        { id: MODES.SURFACE_MAP, icon: SurfaceMapIcon, label: 'Map' },
        { id: MODES.PERCI_NOW, icon: PerciNowIcon, label: 'Now' },
        { id: MODES.PERCI_DESK, icon: PerciDeskIcon, label: 'Desk' },
        { id: MODES.CHAT,   icon: ChatIcon,         label: 'Chat' },
        { id: MODES.ENSEMBLE, icon: EnsembleIcon,   label: 'Ensemble' },
        { id: MODES.COWORK, icon: CoworkIcon,       label: 'Cowork' },
        { id: MODES.CODE,   icon: CodeIcon,         label: 'Code' },
        { id: MODES.SHIPYARD, icon: Ship,   label: 'Shipyard' },
        { id: MODES.POWER_WORKSPACE, icon: Rocket, label: 'Power Workspace' },
        { id: MODES.DOCKET, icon: DocketIcon,       label: 'Docket' },
        { id: MODES.PROJECTS, icon: ProjectsIcon,   label: 'Git Shells' },
        { id: MODES.NOTES,  icon: NotesIcon,        label: 'Notes' },
        { id: MODES.AUTORESEARCH, icon: ResearchIcon, label: 'Autoresearch' },
        { id: MODES.AGENTS, icon: AgentsIcon,       label: 'Agents' },
        { id: MODES.OFFICE, icon: OfficeIcon,       label: 'Office' },
        { id: MODES.BUILD,  icon: BuildIcon,        label: 'Build' },
        { id: MODES.MISSION, icon: MissionIcon,     label: 'Mission' },
        { id: LOCALHOST_WINDOW_ID, icon: Globe, label: 'Localhost', color: 'color-mix(in srgb, var(--text-primary) 20%, #4DA64D)' },
    ];

    return (
        <div className="flex min-w-0 gap-0.5 overflow-x-auto p-1 rounded-xl glass-panel layout-transition">
            {modes.map(mode => {
                const active = currentMode === mode.id
                    || (mode.id === MODES.PERCI_NOW && perciNowOpen)
                    || (mode.id === MODES.PERCI_DESK && perciDeskOpen);
                return (
                    <button
                        key={mode.id}
                        onClick={() => setCurrentMode(mode.id)}
                        aria-label={mode.label}
                        aria-pressed={active}
                        title={mode.label}
                        className="micro-interaction state-feedback relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]"
                    >
                        {/* Sliding active indicator */}
                        {active && (
                            <span
                                className="absolute inset-0 rounded-lg layout-transition"
                                style={{ background: 'var(--bg-hover)', boxShadow: 'inset 0 0 0 1px var(--text-secondary)' }}
                            />
                        )}
                        <mode.icon
                            size={17}
                            className="relative z-10 transition-colors duration-200"
                            style={active ? ICON_ACTIVE : mode.color ? { '--mi-primary': mode.color, '--mi-secondary': 'color-mix(in srgb, ' + mode.color + ' 50%, transparent)', color: mode.color } : ICON_RESTING}
                        />
                    </button>
                );
            })}
        </div>
    );
}
