import { useMode, MODES } from './context/ModeContext';
import ModeSwitcher from './components/ModeSwitcher';
import ChatMode from './components/ChatMode';
import CodeMode from './components/CodeMode';
import BuildMode from './components/BuildMode';
import { BuildModeProvider } from './context/BuildModeContext'; // Keeping original context for now if needed, but primary logic will be in BuildContext
import { BuildProvider } from './context/BuildContext';
import { ChatProvider } from './context/ChatContext';

import { Moon, Sun, Lock, Unlock, Plus } from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import { useChat } from './context/ChatContext';

function AppContent() {
    const { currentMode } = useMode();
    const { isDarkMode, toggleTheme } = useTheme();
    const { isIncognitoMode, toggleIncognitoMode, createNewChat } = useChat();

    return (
        <div className="app h-screen flex flex-col bg-[var(--bg-primary)]">
            {/* Top Navigation / Header */}
            <header className="app-header flex items-center justify-between px-6 py-2 border-b border-[var(--border)] bg-[var(--bg-primary)]">
                <div className="flex items-center gap-2">
                    <img src="/claude-logo.svg" alt="App Logo" className="w-6 h-6" />
                    <h1 className="text-base font-semibold text-[var(--text-primary)]">Open Claude</h1>
                </div>

                <div className="flex items-center gap-4">
                    {currentMode === MODES.CHAT && (
                        <button
                            onClick={createNewChat}
                            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                            title="New Chat"
                        >
                            <Plus size={18} />
                        </button>
                    )}

                    <ModeSwitcher />

                    <div className="h-6 w-px bg-[var(--border)] mx-2" />

                    <button
                        onClick={toggleTheme}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                        {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                    </button>

                    <button
                        onClick={toggleIncognitoMode}
                        className={`p-1.5 rounded-md transition-colors ${isIncognitoMode
                            ? 'bg-[var(--accent)] text-white'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                            }`}
                        title={isIncognitoMode ? "Disable Incognito Mode" : "Enable Incognito Mode"}
                    >
                        {isIncognitoMode ? <Lock size={18} /> : <Unlock size={18} />}
                    </button>
                </div>
            </header>

            {/* Mode-Specific UI */}
            <main className="app-main flex-1 overflow-hidden relative">
                {currentMode === MODES.CHAT && <ChatMode />}
                {currentMode === MODES.CODE && <CodeMode />}
                {currentMode === MODES.BUILD && <BuildMode />}
            </main>
        </div>
    );
}

import { ThemeProvider } from './context/ThemeContext';

export default function App() {
    return (
        <ComposeProviders>
            <AppContent />
        </ComposeProviders>
    );
}

function ComposeProviders({ children }) {
    return (
        <ThemeProvider>
            <BuildModeProvider>
                <BuildProvider>
                    <ChatProvider>
                        {children}
                    </ChatProvider>
                </BuildProvider>
            </BuildModeProvider>
        </ThemeProvider>
    );
}
