import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { DotGridComponent } from '../components/dot-grid/dot-grid.component';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonContent, DotGridComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <ion-content [fullscreen]="true">
      <div style="width:100%; height:600px; position:relative">
        <app-dot-grid
          [dotSize]="10"
          [gap]="15"
          baseColor="#5227FF"
          activeColor="#5227FF"
          [proximity]="120"
          [shockRadius]="250"
          [shockStrength]="5"
          [resistance]="750"
          [returnDuration]="1.5">
        </app-dot-grid>
      </div>
    </ion-content>
  `
})
export class HomePage {}
