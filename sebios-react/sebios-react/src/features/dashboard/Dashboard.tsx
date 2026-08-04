import React, { useEffect, useState } from 'react';
import { useAppContext } from '../../shared/context/AppContext';
import { 
  StatTile, 
  DonutChart, 
  LineChart, 
  AccountsStrip, 
  GoalsSummary, 
  HoldingsTable, 
  AlertsFeed 
} from '../../shared/components';
import { 
  calculateNetWorth, 
  calculateDaysChangePercentage, 
  calculateThirtyDayChangePercentage, 
  calculateInvestedAmount, 
  calculateAssetAllocation 
} from '../../shared/services/dataService';

export const Dashboard: React.FC = () => {
  const { getUserHoldings, getUserHistory } = useAppContext();
  const holdings = getUserHoldings();
  const history = getUserHistory();

  const [stats, setStats] = useState({
    netWorth: 0,
    dayChangePct: 0,
    thirtyDayChangePct: 0,
    investedAmount: 0,
    idleCash: 0
  });

  useEffect(() => {
    if (holdings.length > 0) {
      const netWorth = calculateNetWorth(holdings);
      const dayChangePct = calculateDaysChangePercentage(holdings);
      const thirtyDayChangePct = calculateThirtyDayChangePercentage(history);
      const investedAmount = calculateInvestedAmount(holdings);
      
      // Calculate idle cash
      const idleCash = holdings
        .filter(h => h.assetClass === 'cash')
        .reduce((sum, h) => sum + (h.qty || 0) * (h.ltp || 0), 0);

      setStats({
        netWorth,
        dayChangePct,
        thirtyDayChangePct,
        investedAmount,
        idleCash
      });
    }
  }, [holdings, history]);

  return (
    <section className="panel" id="panel-dashboard" aria-label="Dashboard">
      <header className="panel-header">
        <h1>Dashboard</h1>
        <p className="panel-sub">Every account, every asset class, one intelligent view.</p>
      </header>
      <div className="panel-body">
        <div id="kpi-row" className="kpi-row">
          <StatTile 
            label="Net Worth" 
            value={stats.netWorth} 
            prefix="₹" 
            deltaText={`${stats.thirtyDayChangePct.toFixed(1)}% (30d)`} 
            deltaDirection={stats.thirtyDayChangePct >= 0 ? 'positive' : 'negative'}
          />
          <StatTile 
            label="Day P&L" 
            value={stats.netWorth * (stats.dayChangePct / 100)} 
            prefix={stats.dayChangePct >= 0 ? '+' : '−'} 
            deltaText={`${stats.dayChangePct.toFixed(1)}% today`} 
            deltaDirection={stats.dayChangePct >= 0 ? 'positive' : 'negative'}
          />
          <StatTile 
            label="Total Invested" 
            value={stats.investedAmount} 
            prefix="₹" 
            deltaText={`${((stats.netWorth - stats.investedAmount) / stats.investedAmount * 100).toFixed(1)}% unrealised`} 
            deltaDirection={(stats.netWorth - stats.investedAmount) >= 0 ? 'positive' : 'negative'}
          />
          <StatTile 
            label="Idle Cash" 
            value={stats.idleCash} 
            prefix="₹" 
            deltaText="earning ~0%" 
            deltaDirection="neutral"
          />
        </div>
        
        <div className="grid-2">
          <DonutChart 
            title="Asset Allocation" 
            data={calculateAssetAllocation(holdings)} 
          />
          <LineChart 
            title="30-Day Value" 
            data={history} 
          />
        </div>
        
        <div id="tv-chart-card" className="card">
          {/* TradingView chart would go here */}
          <div className="tv-placeholder">TradingView Chart Placeholder</div>
        </div>
        
        <div id="cas-import" className="card data-container">
          {/* CAS import button */}
          <button className="btn-ghost">Import CAS Statement</button>
        </div>
        
        <div id="accounts-strip" className="accounts-strip data-container">
          <AccountsStrip />
        </div>
        
        <div id="goals-summary-dash" className="card data-container">
          <GoalsSummary />
        </div>
        
        <div id="holdings-table" className="card data-container">
          <HoldingsTable />
        </div>
        
        <div id="alerts-feed" className="card data-container">
          <AlertsFeed />
        </div>
      </div>
    </section>
  );
};


