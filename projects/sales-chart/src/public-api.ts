import { BarController, BarElement, CategoryScale, Chart, LinearScale } from 'chart.js';

import { AfterViewInit, Component, inject, ElementRef, OnDestroy, ViewChild } from '@angular/core';

import { WorkshopSession } from '@demo/workshop-session';

Chart.register(BarController, BarElement, CategoryScale, LinearScale);

@Component({
  selector: 'demo-sales-chart',
  template: `
    <h2>Sales chart</h2>
    <p class="muted">Weekly revenue · CHF thousands</p>
    <div class="plot"><canvas #canvas role="img" aria-label="Weekly revenue in thousands of francs: 24, 31, 28, 42, 38, 48"></canvas></div>
    <button (click)="session.record('sales-chart')">Record interaction</button>
    <span>Session count · {{ session.count() }}</span>
  `,
  styles: ['.plot { position:relative; height:200px; }'],
})
export class RemoteComponent implements AfterViewInit, OnDestroy {
  readonly session = inject(WorkshopSession);
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart<'bar'>;

  ngAfterViewInit() {
    const tickFont = { family: getComputedStyle(this.canvas.nativeElement).fontFamily };
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'bar',
      data: {
        labels: ['W01', 'W02', 'W03', 'W04', 'W05', 'W06'],
        datasets: [{ data: [24, 31, 28, 42, 38, 48], backgroundColor: '#2852c8', borderRadius: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        scales: { x: { ticks: { font: tickFont } }, y: { ticks: { font: tickFont } } },
      },
    });
  }

  ngOnDestroy() { this.chart?.destroy(); }
}
