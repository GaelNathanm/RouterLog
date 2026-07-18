/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { motion } from 'motion/react';

interface DashboardSkeletonProps {
  role?: 'admin' | 'gerente' | 'motorista' | 'vendedor';
}

export default function DashboardSkeleton({ role = 'admin' }: DashboardSkeletonProps) {
  return (
    <div className="w-full space-y-6 animate-pulse select-none">
      {/* Upper bar mimicking greeting / info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-100 rounded-xl p-5 border border-slate-200">
        <div className="space-y-2">
          <div className="h-3 w-32 bg-slate-300 rounded-full"></div>
          <div className="h-6 w-64 bg-slate-350 rounded-lg"></div>
          <div className="h-2.5 w-96 bg-slate-200 rounded-full"></div>
        </div>
        <div className="h-8 w-32 bg-slate-300 rounded-lg shrink-0"></div>
      </div>

      {/* Grid of Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-250 rounded-full"></div>
              <div className="w-8 h-8 rounded-xl bg-slate-200 shrink-0"></div>
            </div>
            <div className="space-y-1.5">
              <div className="h-7 w-24 bg-slate-300 rounded-lg"></div>
              <div className="h-2 w-36 bg-slate-200 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>

      {/* Main body split based on role */}
      {role === 'admin' || role === 'gerente' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Big visual panel (Charts or Map) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Tab selector skeleton */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 max-w-md">
              <div className="h-8 w-1/3 bg-slate-300 rounded-lg"></div>
              <div className="h-8 w-1/3 bg-slate-200 rounded-lg"></div>
              <div className="h-8 w-1/3 bg-slate-200 rounded-lg"></div>
            </div>

            {/* Main content box */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="h-5 w-48 bg-slate-300 rounded-lg"></div>
                <div className="h-8 w-24 bg-slate-200 rounded-lg"></div>
              </div>

              {/* Chart simulation lines */}
              <div className="h-64 bg-slate-50 border border-slate-150 rounded-2xl flex items-end justify-between p-6 overflow-hidden">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((val) => (
                  <div
                    key={val}
                    className="w-full mx-1.5 bg-slate-200 rounded-t-lg transition-all"
                    style={{
                      height: `${10 + Math.sin(val) * 30 + (val % 3) * 15}%`,
                      opacity: 0.4 + (val % 4) * 0.15
                    }}
                  ></div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="h-2.5 w-full bg-slate-200 rounded-full"></div>
                <div className="h-2.5 w-5/6 bg-slate-200 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Right Column: Feed / List details */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="h-4 w-32 bg-slate-300 rounded-lg"></div>
                <div className="h-4 w-12 bg-slate-200 rounded-full"></div>
              </div>

              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 bg-slate-250 rounded-full"></div>
                      <div className="h-2 w-1/2 bg-slate-200 rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : role === 'motorista' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active travel card */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-slate-250 rounded-full"></div>
                <div className="h-5 w-48 bg-slate-350 rounded-lg"></div>
              </div>
              <div className="h-8 w-24 bg-indigo-100 rounded-full shrink-0"></div>
            </div>

            {/* Stop sequence pulsing bars */}
            <div className="space-y-4 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {[1, 2, 3].map((val) => (
                <div key={val} className="relative space-y-2">
                  <div className="absolute -left-6 top-1 w-4.5 h-4.5 rounded-full border-4 border-white bg-slate-300 ring-2 ring-slate-200"></div>
                  <div className="h-4 w-40 bg-slate-300 rounded-lg"></div>
                  <div className="h-2.5 w-64 bg-slate-200 rounded-full"></div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <div className="h-10 flex-1 bg-slate-200 rounded-xl"></div>
              <div className="h-10 flex-1 bg-slate-300 rounded-xl"></div>
            </div>
          </div>

          {/* Right Column: Mini communication / chat box */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
            <div className="h-4 w-32 bg-slate-300 rounded-lg"></div>
            <div className="h-48 bg-slate-50 border border-slate-150 rounded-xl p-4 space-y-4 overflow-hidden">
              <div className="flex items-end gap-2.5 max-w-[80%]">
                <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0"></div>
                <div className="h-8 w-36 bg-slate-200 rounded-xl"></div>
              </div>
              <div className="flex items-end justify-end gap-2.5 max-w-[80%] ml-auto">
                <div className="h-10 w-48 bg-indigo-100 rounded-xl"></div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 flex-1 bg-slate-200 rounded-lg"></div>
              <div className="h-9 w-12 bg-slate-300 rounded-lg shrink-0"></div>
            </div>
          </div>
        </div>
      ) : (
        // Vendedor Dashboard Skeleton
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-5">
            <div className="h-4 w-40 bg-slate-300 rounded-lg"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3 border border-slate-150 rounded-xl space-y-2">
                  <div className="h-3 w-1/2 bg-slate-250 rounded-full"></div>
                  <div className="h-2 w-3/4 bg-slate-200 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b">
              <div className="h-5 w-44 bg-slate-300 rounded-lg"></div>
              <div className="h-8 w-24 bg-slate-200 rounded-lg"></div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="h-3.5 w-1/3 bg-slate-300 rounded-full"></div>
                    <div className="h-2.5 w-1/2 bg-slate-200 rounded-full"></div>
                  </div>
                  <div className="h-6 w-16 bg-slate-250 rounded-full shrink-0"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
