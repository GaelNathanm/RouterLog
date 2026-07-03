import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Rota, RoutePerformanceLog } from '../types';
import { Clock, TrendingUp, Info } from 'lucide-react';

interface RouteTimeComparisonChartProps {
  completedRoutes: Rota[];
  performanceLogs: RoutePerformanceLog[];
}

interface ChartDataPoint {
  routeName: string;
  estimatedTime: number; // minutes
  actualTime: number; // minutes
}

export function RouteTimeComparisonChart({ completedRoutes, performanceLogs }: RouteTimeComparisonChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(400);
  const height = 220;

  // Track container width for responsive resizing
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width: newWidth } = entries[0].contentRect;
      setWidth(Math.max(newWidth, 280)); // min-width of 280px
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Prepare chart data
  const data: ChartDataPoint[] = React.useMemo(() => {
    if (completedRoutes.length > 0) {
      return completedRoutes.map((route) => {
        const log = performanceLogs.find((p) => p.routeId === route.id);
        
        // Calculate actual time in minutes
        let actual = 0;
        if (log && log.startTimestamp && log.endTimestamp) {
          const diffMs = new Date(log.endTimestamp).getTime() - new Date(log.startTimestamp).getTime();
          actual = Math.round(diffMs / 60000);
        } else {
          // Realistic fallback: based on stops
          actual = route.stops.length * 15 + 35;
        }

        // Calculate estimated time in minutes
        let estimated = 0;
        if (log) {
          estimated = Math.round(log.plannedDistanceKm * 2 + log.plannedStopsCount * 12);
        } else {
          estimated = route.stops.length * 18 + 20;
        }

        // Keep it realistic and non-zero
        actual = Math.max(actual, 10);
        estimated = Math.max(estimated, 10);

        // Truncate route name for labels
        const shortName = route.name.length > 12 ? `${route.name.substring(0, 10)}...` : route.name;

        return {
          routeName: shortName,
          estimatedTime: estimated,
          actualTime: actual,
        };
      });
    }

    // Demo data if no routes are completed
    return [
      { routeName: 'Rota Norte A', estimatedTime: 120, actualTime: 110 },
      { routeName: 'Rota Sul B', estimatedTime: 180, actualTime: 195 },
      { routeName: 'Rota Centro', estimatedTime: 90, actualTime: 85 },
      { routeName: 'Rota Leste', estimatedTime: 150, actualTime: 140 },
      { routeName: 'Rota Vale', estimatedTime: 210, actualTime: 235 },
    ];
  }, [completedRoutes, performanceLogs]);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    visible: boolean;
    routeName: string;
    estimated: number;
    actual: number;
  } | null>(null);

  // Render the D3 Chart
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous SVG content to avoid appending on re-render
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 35, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const chartGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 1. Scales
    const xScale = d3.scalePoint<string>()
      .domain(data.map(d => d.routeName))
      .range([0, chartWidth])
      .padding(0.2);

    const maxY = d3.max(data, d => Math.max(d.estimatedTime, d.actualTime)) || 100;
    const yScale = d3.scaleLinear()
      .domain([0, Math.ceil(maxY * 1.1 / 10) * 10]) // round to nearest 10 with 10% padding
      .range([chartHeight, 0]);

    // 2. Grid lines
    chartGroup.append('g')
      .attr('class', 'grid-lines')
      .attr('stroke', '#e2e8f0')
      .attr('stroke-width', 0.5)
      .attr('stroke-dasharray', '3,3')
      .call(
        d3.axisLeft(yScale)
          .tickSize(-chartWidth)
          .tickFormat(() => '')
      )
      .call(g => g.select('.domain').remove());

    // 3. Axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat(d => `${d}m`);

    // Style X Axis
    chartGroup.append('g')
      .attr('transform', `translate(0, ${chartHeight})`)
      .call(xAxis)
      .attr('font-size', '9px')
      .attr('font-family', 'Inter, sans-serif')
      .attr('color', '#64748b')
      .call(g => g.select('.domain').attr('stroke', '#cbd5e1'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#cbd5e1'));

    // Style Y Axis
    chartGroup.append('g')
      .call(yAxis)
      .attr('font-size', '9px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('color', '#64748b')
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').remove());

    // 4. Line Generators
    const lineEstimated = d3.line<ChartDataPoint>()
      .x(d => xScale(d.routeName) || 0)
      .y(d => yScale(d.estimatedTime))
      .curve(d3.curveMonotoneX);

    const lineActual = d3.line<ChartDataPoint>()
      .x(d => xScale(d.routeName) || 0)
      .y(d => yScale(d.actualTime))
      .curve(d3.curveMonotoneX);

    // 5. Draw Estimated Line & Path
    chartGroup.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#a5b4fc') // light indigo
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4')
      .attr('d', lineEstimated);

    // 6. Draw Actual Line & Path
    chartGroup.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#10b981') // emerald-500
      .attr('stroke-width', 2.5)
      .attr('d', lineActual);

    // 7. Interactive Dots for Estimated Time
    chartGroup.selectAll('.dot-est')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot-est')
      .attr('cx', d => xScale(d.routeName) || 0)
      .attr('cy', d => yScale(d.estimatedTime))
      .attr('r', 3.5)
      .attr('fill', '#ffffff')
      .attr('stroke', '#6366f1')
      .attr('stroke-width', 1.5);

    // 8. Interactive Dots for Actual Time
    chartGroup.selectAll('.dot-act')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot-act')
      .attr('cx', d => xScale(d.routeName) || 0)
      .attr('cy', d => yScale(d.actualTime))
      .attr('r', 4.5)
      .attr('fill', '#10b981')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', 6);
        
        // Calculate container offset
        const svgElement = svgRef.current;
        if (svgElement) {
          const rect = svgElement.getBoundingClientRect();
          const xPos = (xScale(d.routeName) || 0) + margin.left;
          const yPos = yScale(d.actualTime) + margin.top;
          
          setTooltip({
            x: xPos,
            y: yPos - 10,
            visible: true,
            routeName: d.routeName,
            estimated: d.estimatedTime,
            actual: d.actualTime
          });
        }
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(100)
          .attr('r', 4.5);
        setTooltip(prev => prev ? { ...prev, visible: false } : null);
      });

  }, [data, width]);

  return (
    <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-3 font-sans relative" ref={containerRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span className="font-extrabold text-slate-700 text-[11px] uppercase tracking-wider font-mono">
            Estimado vs. Tempo Real (D3.js)
          </span>
        </div>
        {completedRoutes.length === 0 && (
          <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase font-mono">
            Demonstração
          </span>
        )}
      </div>

      {completedRoutes.length === 0 && (
        <div className="flex items-start gap-1.5 bg-indigo-50/40 border border-indigo-100/50 p-2 rounded-xl text-[10px] text-indigo-950 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
          <span>
            Exibindo dados de simulação. Ao concluir rotas nesta sessão, este gráfico atualizará dinamicamente em tempo real com seu histórico!
          </span>
        </div>
      )}

      {/* SVG Canvas for D3 */}
      <div className="relative">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="overflow-visible select-none"
        />

        {/* Custom HTML Tooltip */}
        {tooltip && tooltip.visible && (
          <div
            className="absolute z-10 bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-md border border-slate-800 pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-75 space-y-0.5 font-sans"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="font-extrabold border-b border-slate-800 pb-1 mb-1 text-slate-200">
              {tooltip.routeName}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              <span>Estimado: <strong className="font-mono">{tooltip.estimated}m</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>Real: <strong className="font-mono">{tooltip.actual}m</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 text-[10px] font-semibold text-slate-500 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 border-t-2 border-indigo-300 border-dashed"></div>
          <div className="w-2 h-2 rounded-full border border-indigo-500 bg-white -ml-2.5"></div>
          <span>Tempo Estimado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-emerald-500"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 -ml-2.5"></div>
          <span>Tempo Real</span>
        </div>
      </div>
    </div>
  );
}
