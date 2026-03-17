import { haptic } from '@/utils/haptics';
import { useEffect, useState } from 'react';

interface QuickActionsProps {
  onSend: (message: string) => void;
}

interface ActionGroup {
  icon: string;
  label: string;
  actions: { text: string; prompt: string }[];
}

const ACTION_GROUPS: ActionGroup[] = [
  {
    icon: '📡',
    label: '市场',
    actions: [
      { text: '查价格', prompt: '查价格' },
      { text: '市场概览', prompt: '市场概览' },
      { text: '新闻资讯', prompt: '新闻资讯' },
    ],
  },
  {
    icon: '🔍',
    label: '安全',
    actions: [
      { text: '合约扫描', prompt: '合约扫描' },
      { text: '信任评分', prompt: '信任评分' },
      { text: '鲸鱼监控', prompt: '鲸鱼监控' },
    ],
  },
  {
    icon: '💰',
    label: '交易',
    actions: [
      { text: 'Swap兑换', prompt: 'Swap兑换' },
      { text: 'DEX聚合', prompt: 'DEX聚合' },
      { text: '自动交易', prompt: '自动交易' },
      { text: '跟单交易', prompt: '跟单交易' },
    ],
  },
  {
    icon: '👛',
    label: '钱包',
    actions: [
      { text: '查余额', prompt: '查余额' },
      { text: '转账', prompt: '转账' },
      { text: '交易历史', prompt: '交易历史' },
      { text: 'NFT查询', prompt: 'NFT查询' },
    ],
  },
  {
    icon: '📁',
    label: '工具',
    actions: [
      { text: '量化信号', prompt: '量化信号' },
      { text: '生成报告', prompt: '生成报告' },
      { text: '设置提醒', prompt: '设置提醒' },
      { text: '查看工具列表', prompt: '查看工具列表' },
    ],
  },
];

export function QuickActions({ onSend }: QuickActionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const handler = () => {
      setKeyboardOpen(vv.height < window.innerHeight * 0.75);
    };
    vv.addEventListener('resize', handler);
    return () => {
      vv.removeEventListener('resize', handler);
    };
  }, []);

  if (keyboardOpen) return null;

  function handleAction(prompt: string) {
    haptic();
    onSend(prompt);
    setExpanded(false);
  }

  return (
    <div className="px-3 sm:px-4">
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => {
            haptic();
            setExpanded((prev) => !prev);
          }}
          className="mb-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs text-neutral-400 transition-colors hover:border-primary/50 hover:text-primary"
        >
          ⚡ 快捷操作 {expanded ? '▲' : '▼'}
        </button>

        {expanded ? (
          <div className="mb-2 animate-slide-down space-y-2.5">
            {ACTION_GROUPS.map((group, groupIndex) => (
              <div
                key={group.label}
                className="animate-fade-in-up [animation-fill-mode:backwards]"
                style={{ animationDelay: `${groupIndex * 50}ms` }}
              >
                <span className="mb-1 block text-xs text-neutral-500">
                  {group.icon} {group.label}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {group.actions.map((action) => (
                    <button
                      key={action.text}
                      type="button"
                      onClick={() => {
                        handleAction(action.prompt);
                      }}
                      className="rounded-full border border-border px-3 py-1 text-xs text-neutral-400 transition-colors hover:border-primary/50 hover:text-primary active:scale-95"
                    >
                      {action.text}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
