import React from 'react';

export interface StatTileProps {
  label: string;
  value: number | string;
  prefix?: string;
  deltaText?: string;
  deltaDirection?: 'positive' | 'negative' | 'neutral';
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  prefix = '',
  deltaText = '',
  deltaDirection = 'neutral',
}) => {
  return (
    <div className="stat-tile" style={{ border: '1px solid var(--hairline)', padding: '16px', borderRadius: '8px' }}>
      <div className="stat-label" style={{ color: 'var(--ink-muted)', fontSize: '12px' }}>{label}</div>
      <div className="stat-value" style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>
        {prefix}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </div>
      {deltaText && (
        <div className={`stat-delta ${deltaDirection}`} style={{ fontSize: '12px' }}>
          {deltaText}
        </div>
      )}
    </div>
  );
};

export const DonutChart: React.FC<{ title: string; data: any }> = ({ title }) => {
  return (
    <div className="donut-chart-card" style={{ border: '1px solid var(--hairline)', padding: '16px', borderRadius: '8px' }}>
      <h3>{title}</h3>
      <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
        [Donut Chart Placeholder]
      </div>
    </div>
  );
};

export const LineChart: React.FC<{ title: string; data: any }> = ({ title }) => {
  return (
    <div className="line-chart-card" style={{ border: '1px solid var(--hairline)', padding: '16px', borderRadius: '8px' }}>
      <h3>{title}</h3>
      <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
        [Line Chart Placeholder]
      </div>
    </div>
  );
};

export const SectorBars: React.FC = () => {
  return <div style={{ padding: '8px', background: 'var(--surface)' }}>Sector Allocation Bars Placeholder</div>;
};

export const AccountsStrip: React.FC = () => {
  return <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px' }}>Accounts Strip Placeholder</div>;
};

export const GoalsSummary: React.FC = () => {
  return <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px' }}>Goals Summary Placeholder</div>;
};

export const HoldingsTable: React.FC = () => {
  return <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px' }}>Holdings Table Placeholder</div>;
};

export const AlertsFeed: React.FC = () => {
  return <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px' }}>Alerts Feed Placeholder</div>;
};
