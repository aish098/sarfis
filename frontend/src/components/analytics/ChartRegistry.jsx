import React from 'react';
import { 
  DynamicClusteredBarChart, 
  DynamicVarianceBarChart, 
  DynamicWaterfallChart, 
  DynamicComboChart 
} from '../charts/DynamicCharts';
import PowerBIDonut from '../charts/PowerBIDonut';

export default function ChartRegistry({ type, data = [], layout = {}, lookup = {}, series = [], ...rest }) {
  const normType = String(type || '').toUpperCase().trim();

  const standardLayout = {
    orientation: 'vertical',
    tickFontSize: 9,
    yAxisWidth: 60,
    maxBarSize: 32,
    bottomMargin: 40,
    ...layout
  };

  switch (normType) {
    case 'BAR':
    case 'CLUSTERED_BAR':
      return <DynamicClusteredBarChart chartRows={data} layout={standardLayout} lookup={lookup} series={series} {...rest} />;
    
    case 'VARIANCE':
      return <DynamicVarianceBarChart chartRows={data} layout={standardLayout} lookup={lookup} {...rest} />;
    
    case 'WATERFALL':
      return <DynamicWaterfallChart waterfall={data} layout={standardLayout} lookup={lookup} {...rest} />;
    
    case 'COMBO':
      return <DynamicComboChart chartRows={data} layout={standardLayout} lookup={lookup} barSeries={series} {...rest} />;
    
    case 'DONUT':
    case 'PIE':
      return <PowerBIDonut chartRows={data} series={series} {...rest} />;

    default:
      return (
        <div className="p-8 text-center text-slate-400 font-bold border border-slate-150 border-dashed rounded-2xl">
          Chart type "{type}" is not registered in the registry.
        </div>
      );
  }
}
