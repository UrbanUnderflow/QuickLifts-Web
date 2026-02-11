import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { presenceService, AgentPresence } from '../../api/firebase/presence/service';
import { Calendar, Clock, RefreshCcw } from 'lucide-react';

const statusTokens = {
  working: {
    label: 'Working',
    className: 'bg-green-500/10 text-green-400 border border-green-500/30',
    deskGlow: 'shadow-[0_0_25px_rgba(34,197,94,0.45)]'
  },
  idle: {
    label: 'Idle',
    className: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
    deskGlow: 'shadow-[0_0_20px_rgba(251,191,36,0.35)]'
  },
  offline: {
    label: 'Offline',
    className: 'bg-zinc-600/20 text-zinc-300 border border-zinc-600/40',
    deskGlow: 'shadow-none'
  }
};

const formatRelative = (date?: Date) => {
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return date.toLocaleTimeString();
};

const AgentDesk: React.FC<{ agent: AgentPresence }> = ({ agent }) => {
  const status = statusTokens[agent.status];
  return (
    <div className={`relative bg-[#111417] border border-zinc-800 rounded-2xl p-5 overflow-hidden transition-all duration-300 ${status.deskGlow}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-zinc-400">{agent.displayName}</p>
          <h3 className="text-2xl font-semibold text-white flex items-center gap-2">
            <span>{agent.emoji || '⚡️'}</span>
            {agent.status === 'working' ? 'Typing…' : 'At Desk'}
          </h3>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full ${status.className}`}>
          {status.label}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Current Task</p>
          <p className="text-sm text-white mt-1 min-h-[32px]">
            {agent.currentTask || '—'}
          </p>
        </div>
        {agent.notes && (
          <div className="bg-[#1a1e24] border border-zinc-700 rounded-xl p-3">
            <p className="text-xs text-zinc-500 mb-1">Notes</p>
            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{agent.notes}</p>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatRelative(agent.lastUpdate)}</span>
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{agent.lastUpdate?.toLocaleDateString() || '—'}</span>
        </div>
      </div>

      <div className={`agent-avatar ${agent.status}`}>
        <div className="desk" />
        <div className="chair" />
        <div className="character">
          <div className="head" />
          <div className="body">
            <div className="arm left" />
            <div className="arm right" />
          </div>
        </div>
        <div className="monitor" />
      </div>
    </div>
  );
};

const VirtualOfficeContent: React.FC = () => {
  const [agents, setAgents] = useState<AgentPresence[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const unsubscribe = presenceService.listen((next) => {
      setAgents(next.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    });
    return () => unsubscribe();
  }, [refreshKey]);

  const activeCount = useMemo(() => agents.filter((a) => a.status === 'working').length, [agents]);

  return (
    <div className="min-h-screen bg-[#050607] text-white">
      <Head>
        <title>Virtual Office - Pulse Admin</title>
      </Head>
      <AdminRouteGuard>
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm text-zinc-500">Operations</p>
              <h1 className="text-3xl font-semibold">Virtual Office</h1>
              <p className="text-zinc-400 text-sm mt-1">Watch agents work in real time.</p>
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
            >
              <RefreshCcw className="w-4 h-4" /> Refresh listener
            </button>
          </div>

          <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-[#111417] border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 uppercase mb-1">Agents online</p>
              <p className="text-2xl font-semibold">{agents.length}</p>
            </div>
            <div className="bg-[#111417] border border-zinc-800 rounded-2xl p-4">
              <p className="text-xs text-zinc-500 uppercase mb-1">Typing now</p>
              <p className="text-2xl font-semibold text-green-400">{activeCount}</p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {agents.length === 0 && (
              <div className="col-span-full text-center text-zinc-500 border border-dashed border-zinc-700 rounded-2xl p-10">
                No agents detected yet. Presence updates will appear here as soon as you emit a heartbeat.
              </div>
            )}
            {agents.map((agent) => (
              <AgentDesk key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      </AdminRouteGuard>

      <style jsx global>{`
        .agent-avatar {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .agent-avatar .desk {
          position: absolute;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          width: 120px;
          height: 12px;
          background: linear-gradient(90deg, #1f2933, #2c3542);
          border-radius: 999px;
          opacity: 0.6;
        }
        .agent-avatar .monitor {
          position: absolute;
          bottom: 40px;
          left: 50%;
          transform: translateX(-50%);
          width: 46px;
          height: 28px;
          border-radius: 6px;
          background: #0f172a;
          border: 2px solid rgba(96,165,250,0.3);
          box-shadow: 0 0 18px rgba(96,165,250,0.25);
        }
        .agent-avatar .chair {
          position: absolute;
          bottom: 10px;
          left: calc(50% - 52px);
          width: 28px;
          height: 32px;
          border-radius: 12px;
          background: #1e293b;
          opacity: 0.8;
        }
        .agent-avatar .character {
          position: absolute;
          bottom: 42px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .agent-avatar .head {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #fde68a;
        }
        .agent-avatar .body {
          width: 24px;
          height: 28px;
          background: #38bdf8;
          margin-top: 4px;
          border-radius: 12px 12px 6px 6px;
          position: relative;
          overflow: visible;
        }
        .agent-avatar .arm {
          position: absolute;
          top: 12px;
          width: 18px;
          height: 6px;
          background: #fde68a;
          border-radius: 999px;
          transform-origin: left center;
        }
        .agent-avatar .arm.right {
          right: -14px;
          animation: typing 0.8s infinite;
        }
        .agent-avatar .arm.left {
          left: -14px;
          animation: typing 0.8s infinite alternate;
        }
        .agent-avatar.idle .arm.right,
        .agent-avatar.idle .arm.left,
        .agent-avatar.offline .arm.right,
        .agent-avatar.offline .arm.left {
          animation: none;
          opacity: 0.6;
        }
        .agent-avatar.offline .monitor { opacity: 0.2; }
        @keyframes typing {
          0% { transform: rotate(-3deg); }
          50% { transform: rotate(6deg); }
          100% { transform: rotate(-2deg); }
        }
      `}</style>
    </div>
  );
};

export default function VirtualOfficePage() {
  return <VirtualOfficeContent />;
}
